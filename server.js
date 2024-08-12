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
const hc_secret = process.env.HCAPTCHA_SECRET;

const useHttps = false;

const LiteWallet = require('./zingolib-wrapper/zingolib');
const { TxBuilder } = require('./zingolib-wrapper/utils/utils');
// const { join } = require('path');

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
const lwd = "https://zec.rocks:443/";
const zingo = new LiteWallet(lwd, "main");
let syncing = true;
let logStream;

// Initialize zingolib
zingo.init().then(async () => {    
    // Start the logger
    logStream = fs.createWriteStream("log.txt", {flags:'a'});

    // Send payments every 2 minutes
    const timerID = setInterval(async() => {
        const sendProgress = zingo.inSend;
        const notes = await zingo.fetchNotes();
        let pending = notes.pending_orchard_notes.length > 0 || notes.pending_sapling_notes.length > 0 || notes.pending_utxos.length > 0;        
        syncing = zingo.inRefresh;

        console.log(`Queue: ${queue.length} | Sending: ${sendProgress} | Pending: ${pending} | Syncing: ${syncing}`);
        if(queue.length > 0 && !sendProgress && !pending && !syncing) {
            const tmpQueue = queue.slice();  

            zingo.sendTransaction(tmpQueue).then((txid)=>{
                console.log(txid);
                logStream.write(`txid: ${txid}\n============\n`);

                // clear the queue
                tmpQueue.forEach((el) => {
                    queue.splice(queue.indexOf(el), 1);
                });
            }).catch((err) => {
                console.log(err);
            });
        }

        // Clear waitlist for users that waited more than waittime
        const timeStamp = new Date();
        waitlist.forEach((el) => {
            const oldTimeStamp = el.timestamp;
            const nextClaim = waittime - ((timeStamp - oldTimeStamp) / (1000*60));
            if(nextClaim < 0) {
                waitlist.splice(waitlist.indexOf(el), 1);
            }
        });
        console.log(`Waitlist length: ${waitlist.length}`); 
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
    res.send(addr[0].address);
});

app.get('/balance', async (req, res) => {
    // If syncing, return balance of 0.0
    const ss = await zingo.doSyncStatus();
    syncing = ss.in_progress;

    if(syncing) res.send('0.0');
    else {
        // Fetch total balance and return        
        const bal = await zingo.fetchTotalBalance();        
        res.send(`${bal.toFixed(8)}`);
    }
});

app.get('/log', async (req, res) => {
    res.sendFile(path.join(__dirname, 'log.txt'));
});

app.get('/txns', async (req, res) => {
    const txList = zingo.getTransactionsSummaries();    
    const receivedTxns = txList.transaction_summaries
        .filter((t) => t.kind == "received")
        .map((tx) => {
            return {
                'value': (tx.value / 10**8),
                'time': tx.datetime,
                'memo': tx.orchard_notes ? tx.orchard_notes[0].memo : tx.sapling_notes ? tx.sapling_notes[0].memo : "No memo available"
            }
        });

    res.json(receivedTxns.slice(0,10));
});

app.get('/stats', async (req, res) => {
    const txList = zingo.getTransactionsSummaries(); 
    const txSent = txList.transaction_summaries.filter((t) => t.kind == "sent");
    
    const totalSent = txSent.reduce((acc, el) => acc + el.value, 0);
    const totalClaims = txSent.length;
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
            const ipAddress = userIp.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)[0];             
            try {
                const proxyOrVpn = await axios.get(`http://check.getipintel.net/check.php?ip=${ipAddress}&contact=james.j.katz@protonmail.com`);
                if(proxyOrVpn.data >= 0.95) {
                    console.log("User blocked!");
                    logStream.write(`${timeStamp .toISOString()} | Proxy or VPN blocked: ${ipAddress}\n\n`);
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
                logStream.write(`${timeStamp .toISOString()} | Sequential IP blocked: ${ipAddress}\n\n`);
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
                .setAmount(pay)
                .setMemo(memo);
            
            // Get sendJson
            const sendJson = tx.getSendJSON();

            // Check if faucet has enough bals
            const bal = await zingo.fetchTotalBalance();
            const fee = await zingo.getDefaultFee();
            const queueSum = queue.map((el) => el.amount).reduce((acc, curr) => acc + curr, fee);
            
            if(queueSum + sendJson[0].amount > (bal * 10**8)) {
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
            logStream.write(`${timeStamp .toISOString()} | IP: ${userIp} | Fingerprint: ${userFp} | Address: ${addr}\n\n`);

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