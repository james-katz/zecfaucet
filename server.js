// const { Worker } = require('worker_threads');

const express = require('express');
const bodyParser = require('body-parser')
const cors = require('cors')

const axios = require('axios');

const https = require('https');
const fs = require('fs');

const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const {verify} = require('hcaptcha');

const lwd_url = process.env.LWD_URL;
const hc_secret = process.env.HCAPTCHA_SECRET;

const useHttps = false;

const LiteWallet = require('./zingolib-wrapper/zingolib');
const { TxBuilder } = require('./zingolib-wrapper/utils/utils');
// const { join } = require('path');

const { initializeDatabase, Transaction, Claim } = require('./sequelize');


const app = express();
const port = 2653;

// Set faucet payout in decimal ZEC
const u_payout = 0.0005;
const z_payout = 0.0004;
const t_payout = 0.0003;
const memo = "Thanks for using ZecFaucet.com"

// Queue for the faucet payout
let queue = [];
const waitlist = [];
const waittime = 120; // Time in minuts before next claim

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()) // to convert the request into JSON
app.use(cors()) // to allow cross origin requests
app.set("trust proxy", true);

// Serve static files from the 'dist' directory
// app.use(express.static(path.join(__dirname, 'dist')));

// Setup lib
const zingo = new LiteWallet(lwd_url, "main", false);
let syncing = true;
let logStream;

// Initialize zingolib
zingo.init().then(async () => {    
    //initialize the database
    await initializeDatabase();

    // Start the logger
    logStream = fs.createWriteStream("log.txt", {flags:'a'});

    // Send payments every 2 minutes
    const timerID = setInterval(async() => {
        const sendProgress = zingo.isSending;
        const notes = await zingo.fetchNotes();
        let pending = notes.pending_orchard_notes.length > 0 || notes.pending_sapling_notes.length > 0 || notes.pending_utxos.length > 0;        
        syncing = zingo.inRefresh;

        console.log(`Queue: ${queue.length} | Sending: ${sendProgress} | Pending: ${pending} | Syncing: ${syncing}`);
        if(queue.length > 0 && !sendProgress && !pending && !syncing) {
            const tmpQueue = queue.slice();  
            const totalValue = tmpQueue.map((el) => el.amount).reduce((acc, curr) => acc + curr, 0);

            zingo.sendTransaction(tmpQueue).then(async (txid)=>{
                console.log(txid);
                logStream.write(`txid: ${txid}\n============\n`);

                try {
                    // add Transaction and claims to database
                    const newTx = await Transaction.create({
                        txid: txid,
                        kind: 'sent',
                        value: totalValue,
                        fee: 10000,
                        memo: memo
                    });
                    
                    for(const claim of tmpQueue) {
                        await newTx.createClaim({
                            address: claim.address
                        });
                    }
                }
                catch {
                    console.log("Couldn't add new tx to database");
                }

                // remove claims from the original queue, keep newly added items
                tmpQueue.forEach((el) => {
                    queue.splice(queue.indexOf(el), 1);
                });
            }).catch((err) => {
                console.log(err);
            });
        }

        // Clear waitlist for users that waited more than `waittime`
        const timeStamp = new Date();
        waitlist.forEach((el) => {
            const oldTimeStamp = el.timestamp;
            const nextClaim = waittime - ((timeStamp - oldTimeStamp) / (1000*60));
            if(nextClaim < 0) {
                waitlist.splice(waitlist.indexOf(el), 1);
            }
        });
        console.log(`Waitlist length: ${waitlist.length}`); 

        // let's use the same timer to detect donations and add them to the database
        const lastDbTxid = await Transaction.findAll({
            order: [['createdAt', 'DESC']],
            limit: 1
        });

        const lastTxid = zingo.fetchLastTxId();

        if(lastDbTxid[0].txid != lastTxid) {                   
            const txSummaries = await zingo.getTransactionsSummaries();
            const walletTxns = txSummaries.transaction_summaries.reverse();
            let count = 0;
            for(const tx of walletTxns) {
                if(tx.txid == lastDbTxid[0].txid) {
                    console.log(`Done looking for donations, received a total of ${count} donations.`);
                    break;
                }

                if(tx.kind == 'received') {
                    try {
                        const txTimestamp = new Date(tx.datetime * 1000);

                        let txMemo = "No memo available";
                        if(tx.orchard_notes[0] && tx.orchard_notes[0].memo != null) {
                            txMemo = tx.orchard_notes[0].memo;
                        }
                        else if(tx.sapling_notes[0] && tx.sapling_notes[0].memo != null) {
                            txMemo = tx.sapling_notes[0].memo;
                        }
                        const newDonation = await Transaction.create({
                            txid: tx.txid,
                            kind: tx.kind,
                            value: tx.value,                            
                            memo: txMemo,
                            createdAt: txTimestamp
                        });
                        console.log(`New donation of ${tx.value / 10**8} received!\nMessage: ${txMemo}`);
                    }
                    catch {
                        console.log("Couldn't insert donation into db ...");
                    }
                    count += 1;
                }

            }
        }
        else {
            console.log("No new donation");           
        }

    }, 2 * 60 * 1000);
}).catch((err) => { console.log(err) });

// Serve the Vue.js app
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'dist', 'index.html'));
// });

app.get ('/payout', (req, res) =>{
    res.json({
        u_pay: u_payout,
        z_pay: z_payout,
        t_pay: t_payout
    });
});

app.get('/donate', async (req, res) => {    
    const addr = await zingo.fetchAllAddresses();
    // const seed = await zingo.getWalletSeed();
    // console.log(seed);
    res.send(addr[0].address);
});

app.get('/balance', async (req, res) => {    
    zingo.fetchTotalBalance().then((bal) => {
        res.send(`${bal}`);
    })
    
});

app.get('/log', async (req, res) => {
    res.sendFile(path.join(__dirname, 'log.txt'));
});

app.get('/txns', async (req, res) => {
    // const txList = zingo.getTransactionsSummaries();    
    // const receivedTxns = txList.transaction_summaries
    //     .filter((t) => t.kind == "received")
    //     .map((tx) => {            
    //         let memo = "No memo available";
    //         if(tx.orchard_notes[0] && tx.orchard_notes[0].memo != null) {
    //             memo = tx.orchard_notes[0].memo;
    //         }
    //         else if(tx.sapling_notes[0] && tx.sapling_notes[0].memo != null) {
    //             memo = tx.sapling_notes[0].memo;
    //         }
    //         return {
    //             'value': (tx.value / 10**8),
    //             'time': tx.datetime,
    //             'memo': memo
    //         }
    //     });

    // res.json(receivedTxns.reverse().slice(0,10));
    const recentDonations = await Transaction.findAll({
        where: { kind: 'received' },
        order: [['createdAt', 'DESC']],
        limit: 10
    });

    const donationsJson = recentDonations.map((el) => {
        return {
            'value': (el.value / 10**8),
            'time': el.createdAt,
            'memo': el.memo
        }
    });
    res.json(donationsJson);
});

app.get('/stats', async (req, res) => {
    const totalSent = await Transaction.sum('value', {
        where: { kind: 'sent' }
    });

    const totalClaims = await Claim.count();

    const result = {
        sent: (totalSent / 10**8).toFixed(8),
        claims: totalClaims
    }
    res.json(result);
});

app.post('/add', async (req, res) => {
    const ss = await zingo.doSyncStatus();
    syncing = ss.in_progress; 

    if(syncing) res.send('syncing');
    else {
        // CHeck if it is a valid address
        const addr = req.body.address;
        const validAddr = await zingo.parseAddress(addr);    
        const token = req.body.token;
        const validToken = await verify(hc_secret, token);
        if(!validToken.success) {
            res.send("invalid-token");
            return;
        }
        else if(validAddr) {
            // First, check if user can claim faucet
            const userIp = req.ip; // TODO improve remote IP fetching
            const userFp = req.body.fingerprint;
            const timeStamp = new Date();
            
            // Check if user is using proxy/vpn            
            try {
                const ipAddress = userIp.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)[0];             
                const proxyOrVpn = await axios.get(`http://check.getipintel.net/check.php?ip=${ipAddress}&contact=james.j.katz@protonmail.com`);
                if(proxyOrVpn.data >= 0.95) {
                    console.log("User blocked!");
                    logStream.write(`${timeStamp.toISOString()} | Proxy or VPN blocked: ${ipAddress}\n\n`);
                    res.send('invalid-token');
                    return;
                }
            }
            catch(err) {
                console.log("Couldn't check user ip for proxy or vpn.");
            }

            const user = waitlist.filter(el => (el.ip === userIp || el.fp === userFp || el.address === addr));
            if(user.length > 0) {
                const oldTimeStamp = user[0].timestamp;
                const nextClaim = waittime - ((timeStamp - oldTimeStamp) / (1000*60));
                if(nextClaim < 0) {
                    waitlist.splice(waitlist.indexOf(user[0]), 1);
                } 
                else {
                    res.send(`greedy ${ Math.ceil(nextClaim) }`);                
                    return;
                }   
            }

            // Also block sequential IP addresses based on the first 2 octets
            let ipOctet = userIp.slice(0,15);
            let seqIp = waitlist.filter((el) => el.ip.startsWith(ipOctet));
            if(seqIp.length > 0) {
                logStream.write(`${timeStamp.toISOString()} | Sequential IP blocked: ${ipAddress}\n\n`);
                res.send('invalid-token');
                return;
            }

            const pay = validAddr.address_kind === 'unified' ? u_payout.toFixed(4) : validAddr.address_kind === 'sapling' ? z_payout.toFixed(4) : 0;
            // Reject if it's transparent address
            if(pay == 0) {
                res.send("transparent");
                return;
            }
            
            // Construct transaction
            const tx = new TxBuilder()
                .setRecipient(addr)
                .setAmount(parseFloat(pay))
                .setMemo(memo);
            
            // Get sendJson
            const sendJson = tx.getSendJSON();

            // Check if faucet has enough bals
            const bal = await zingo.fetchTotalBalance();
            const fee = await zingo.getDefaultFee();
            const queueSum = queue.map((el) => el.amount).reduce((acc, curr) => acc + curr, fee);
            
            if(queueSum + sendJson[0].amount >= (bal * 10**8)) {
                res.send('faucet-dry');
                return;
            }            
            
            // Add tx to the queue
            queue.push(sendJson[0]);
            console.log("New address added to the queue");
            
            // Add user IP and browser firgerprint to the wait list
            waitlist.push({
                address: addr,
                ip: userIp,
                fp: userFp,
                timestamp: timeStamp
            });

            // Add this claim to log file
            logStream.write(`${timeStamp.toISOString()} | IP: ${userIp} | Fingerprint: ${userFp} | Address: ${addr}\n\n`);

            res.json({
                success: 'success',
                amount: pay
            });
        }
        else res.send('invalid');        
    }
});

if(useHttps) {
    const options = {
        key: fs.readFileSync('privkey.pem'),
        cert: fs.readFileSync('cert.pem')
    };
    https.createServer(options, app).listen(port);
    console.log(`App listening at https://localhost:${port}`)
}
else {
    app.listen(port, () => {
        console.log(`App listening at http://localhost:${port}`)
    });
}

process.on('SIGINT', async () => {
    console.log("Safely shutdown zingolib");
    logStream.end();
    await zingo.deinitialize();
    process.exit();
});