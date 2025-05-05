const { Worker } = require('worker_threads');

const express = require('express');
const bodyParser = require('body-parser')
const cors = require('cors')

const axios = require('axios');

const crypto = require('crypto');

const https = require('https');
const fs = require('fs');

const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const lwd_url = process.env.LWD_URL;
const network = process.env.NETWORK;

const useHttps = process.env.USE_HTTPS === "true";
const blockVpn = process.env.BLOCK_VPN === "true";

const LiteWallet = require('./zingolib-wrapper/zingolib');
const { TxBuilder } = require('./zingolib-wrapper/utils/utils');
// const { join } = require('path');

const { initializeDatabase, Transaction, Claim, Challenge } = require('./sequelize');
const { Op, fn, col } = require('sequelize');

const app = express();
const port = 2653;

// Set faucet payout in decimal ZEC (Mainnet / Testenet)
const u_payout = network == "main" ? 0.0005 : 0.3;
const z_payout = network == "main" ? 0.0004 : 0.2;
const t_payout = network == "main" ? 0.0003 : 0.1;

const memo = `Thanks for using ${network == 'test' ? 'testnet.' : ''}ZecFaucet.com`;

// Queue for the faucet payout
const waitTime = 60; // Time in minuts before next claim
const payInterval = 3; // Time in minuts between payments

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()) // to convert the request into JSON
app.use(cors()) // to allow cross origin requests
app.set("trust proxy", true);

// Setup zingolib
const zingo = new LiteWallet(lwd_url, network, false);
let logStream;

const fakeSendTransaction = (foo) => {
    return new Promise((resolve, reject) => {
        setInterval(() => {
            resolve("fakeTxId");
        }, 2 * 1000);
    });
}

// Initialize zingolib
zingo.init().then(async () => {    
    //initialize the database
    await initializeDatabase();

    // Start the logger
    logStream = fs.createWriteStream("log.txt", {flags:'a'});

    // Send payments every 3 minutes
    const timerID = setInterval(async() => {
        
        const sendProgress = zingo.isSending;
        // const notes = await zingo.fetchNotes();
        // let pending = notes.pending_orchard_notes.length > 0 || notes.pending_sapling_notes.length > 0 || notes.pending_utxos.length > 0;        

        const queue = await Claim.findAll({
            where: {
                pending: true
            }
        });

        console.log(`Queue: ${queue.length} | Sending: ${sendProgress}`);
        if(queue.length > 0 && !sendProgress) {
            const sendJson = queue.flatMap((q) => {
                const tx = new TxBuilder()
                    .setRecipient(q.address)
                    .setAmount(parseFloat(u_payout))
                    .setMemo(memo);

                return tx.getSendJSON();
            });  

            zingo.sendTransaction(sendJson).then(async (txid)=>{
            // fakeSendTransaction(sendJson).then(async (txid)=>{                               
                const totalValue = sendJson.map((el) => el.amount).reduce((acc, curr) => acc + curr, 0);
                
                // console.log(totalValue)
                try {
                    // add Transaction and claims to database
                    const newTx = await Transaction.create({
                        txid: txid,
                        kind: 'sent',
                        value: totalValue,
                        fee: 10000,
                        memo: memo
                    });
                    
                    for(const claim of queue) {
                        claim.pending = false;
                        claim.transactionTxid = newTx.txid;                        
                        await claim.save();
                    }
                }
                catch(err) {
                    console.log("Couldn't add new tx to database");
                    // console.log(err);
                }
                
                logStream.write(`txid: ${txid}\n============\n`);
            }).catch((err) => {
                console.log(err);
            });
        }  
    }, payInterval * 60 * 1000);    
    
    // Check new donations
    const donationsTimerId = setInterval(async () => {
        const sendProgress = zingo.isSending;
        if(sendProgress) return;
        
        const lastDbTxid = await Transaction.findAll({
            order: [['createdAt', 'DESC']],
            limit: 1
        });

        const lastTxid = zingo.fetchLastTxId();

        if(lastTxid && lastDbTxid[0] && lastDbTxid[0].txid && lastDbTxid[0].txid != lastTxid) {                   
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

                        await Transaction.create({
                            txid: tx.txid,
                            kind: tx.kind,
                            value: tx.value,                            
                            memo: txMemo,
                            createdAt: txTimestamp
                        });
                        console.log(`New donation of ${tx.value / 10**8} received!\nMessage: ${txMemo}`);
                    }
                    catch {
                        // console.log("Couldn't insert donation into db ...");
                    }
                    count += 1;
                }
            }
        }
        else {
            console.log("No new donation");           
        }
    }, payInterval * 1.5 * 60 * 1000);
}).catch((err) => { console.log(err) });

function getClientIp(req) {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        // x-forwarded-for can contain multiple IPs, take the first one
        return xForwardedFor.split(',')[0].trim();
    }
    return req.ip; // Fallback to req.ip if no x-forwarded-for header
};

app.get ('/api/network', (req, res) =>{
    res.json({
        net: network
    });
});

app.get ('/api/payout', (req, res) =>{
    res.json({
        status: 200,
        payout: {
            u_pay: u_payout,
            z_pay: z_payout,
            t_pay: t_payout
        }
    });
});

app.get('/api/donate', async (req, res) => {    
    const addr = await zingo.fetchAllAddresses();
    res.send(addr[0].address);
});

app.get('/api/balance', async (req, res) => {    
    zingo.fetchTotalBalance().then((bal) => {
        res.send(`${bal.toFixed(8)}`);
    });
});

app.get('/api/log', async (req, res) => {
    res.sendFile(path.join(__dirname, 'log.txt'));
});

app.get('/api/dashboard-stats', async (req, res) => {
    let claimsPerHour = await Claim.count({
        where: {
            pending: false,
            createdAt: {
                [Op.gte]: new Date(new Date() - 60 * 60 * 1000)
            }
        }
    });

    const totalSent = await Transaction.sum('value', {
        where: { kind: 'sent' }
    });
    const totalClaims = await Claim.count();
    const totalReceived = await Transaction.sum('value', {
        where: { kind: 'received' }
    });

    const balance = await zingo.fetchTotalBalance();

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const rawResults = await Transaction.findAll({
        attributes: [
            [fn('DATE', col('createdAt')), 'date'],
            [fn('COUNT', '*'), 'total']
        ],
        where: {
            kind: 'sent',
            createdAt: {
                [Op.gte]: sevenDaysAgo
            }
        },
        group: [fn('DATE', col('createdAt'))],
        order: [[fn('DATE', col('createdAt')), 'ASC']],
        raw: true
    });

    // Map to clean array with formatted date
    const latestClaims = rawResults.map(row => ({
        name: new Date(row.date).toLocaleDateString('en-US'),
        claims: parseInt(row.total, 10)
    }));

    res.json({
        claimsPerHour: claimsPerHour,
        totalClaims: totalClaims,
        totalSent: totalSent / 10**8,
        totalReceived: totalReceived / 10**8,
        faucetBalance: balance,
        latestClaims: latestClaims
    })
});

app.get('/api/txns', async (req, res) => {
    const recentDonations = await Transaction.findAll({
        where: { 
            kind: 'received',
            value: {
                [Op.gte]: 50000
            }
         },
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

app.get('/api/stats', async (req, res) => {
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

const canClaim = async (address, ip) => {
    // Check if user awaited `waitTime` (even if user is still in the queue)
    const cutoffTime = new Date(Date.now() - waitTime * 60 * 1000);
  
    const recentClaim = await Claim.findOne({
        where: {
            [Op.or]: [
                { address },
                { ip }
            ],
            createdAt: {
            [Op.gte]: cutoffTime
        }
    },
        order: [['createdAt', 'DESC']]
    });
    
    if (!recentClaim) {
        return { allowed: true };
    }
  
    const now = new Date();
    const claimTime = new Date(recentClaim.createdAt);
    const elapsedMs = now - claimTime;
    const elapsedMinutes = elapsedMs / 60000;
    const remainingMinutes = Math.ceil(waitTime - elapsedMinutes);
  
    return {
        allowed: false,
        remaining: remainingMinutes
    };
};

const checkValidPoW = async (token) => {
    let nonce = token.nonce;
    
    const hashMessage = (input) => {
        const hash = crypto.createHash('sha256');
        hash.update(input);
        const hashArray = new Uint8Array(hash.digest());
        return Array.from(new Uint8Array(hashArray)).map(b => b.toString(16).padStart(2, '0')).join('');
    };        
    
    let message;
    let minZeros = '0'.repeat(4);

    try {
        const challenge = await Challenge.findOne({
            where: {
                id: token.id
            }
        });
        if (challenge) {
            message = challenge.message;
            diff = challenge.difficulty;

            const trial = message + nonce;
            const hash = hashMessage(trial);

            const hashesMatch = hash == token.hash;
            const hasMinZeros = hash.startsWith(minZeros);

            if(hashesMatch && hasMinZeros) {
                console.log(`Valid solution for proof of work for challenge id ${challenge.id}!`);
                await challenge.destroy();
                return true;
            }
        }       
    }
    catch(err) {
        console.log(err);
        return false;
    }

    return false;
}

app.post('/api/challenge', async (req, res) => {
    // CHeck if it is a valid address
    const userAddr = req.body.address;
    const userIp = getClientIp(req);    
    let isVpn = false;

    const validAddr = await zingo.parseAddress(userAddr);
    if(validAddr && validAddr.address_kind === 'unified' && validAddr.chain_name == network) {
        const userCanClaim = await canClaim(userAddr, userIp);
        if (userCanClaim.allowed) {
            // Before anything, check if user is using proxy/vpn            
            try {        
                const ipAddress = userIp.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)[0];             
                const proxyOrVpn = await axios.get(`http://check.getipintel.net/check.php?ip=${ipAddress}&contact=james.j.katz@protonmail.com`);
                if(proxyOrVpn.data > 0.90 && blockVpn) {
                    console.log("VPN/Proxy detected. Using a harder challenge!");
                    isVpn = true;
                    // const timeStamp = new Date();
                    // logStream.write(`${timeStamp.toISOString()} | Proxy or VPN blocked: ${userIp}\n\n`);
                    // res.send({
                    //     status: 403,
                    //     message: `Sorry, we couldn't verify you're not a robot.`
                    // });
                    // return;
                }                
            }
            catch(err) {
                console.log("Couldn't check user ip for proxy or vpn.");
            }

            // Then check if faucet has enough balance
            // TODO: Move to a separete function
            const bal = await zingo.fetchTotalBalance();
            const queue = await Claim.findAll({
                where: {
                    pending: true
                }
            });
            const fee = await zingo.getDefaultFee() * queue.length;
            const queueSum = queue.map((el) => el.amount).reduce((acc, curr) => acc + curr, fee);
            
            if((queueSum + u_payout) * 2 >= (bal * 10**8)) {
                res.send({
                    status: 503,
                    message: `It looks like the faucet wallet don't have enough funds 🥹`
                });
                return;
            }
            
            // If everything is ok, send the challenge to the user            
            try {  
                // Get faucet claims in the last hour
                let claimsPerHour = await Claim.count({
                    where: {
                        pending: false,
                        createdAt: {
                            [Op.gte]: new Date(new Date() - 60 * 60 * 1000)
                        }
                    }
                });
                console.log(`Faucet claims/hour: ${claimsPerHour}`);
                const base = isVpn ? 10 : 5;
                let baseDiff = Math.min(50, base + Math.floor(claimsPerHour / 3));

                let effort = 'easy';
                if(baseDiff > 7) effort = 'medium';
                if(baseDiff >= 10) effort = 'hard';

                // Get the total user claims (wallet address or IP)
                let userClaimCount = await Claim.count({
                    where: {
                        [Op.or]: [
                            { address: userAddr },
                            { ip: userIp }
                        ]
                    }
                });
                const extraZeros = Math.floor(userClaimCount / 8);
                const finalDiff = baseDiff + extraZeros;
                if(userClaimCount > 30) effort = 'medium';
                if(userClaimCount > 50) effort = 'hard';                

                const now = new Date().toLocaleTimeString('en-US').replace(/\s/g, '-');
                const msg = `${userAddr}-${userIp}-${now}` ;
                const challenge = await Challenge.create({
                    message: msg,
                    difficulty: finalDiff,                    
                });

                console.log(`New challenge: id: ${challenge.id}, difficulty: ${finalDiff}, effort level: ${effort}`);

                res.send({
                    status: 200,
                    message: {
                        id: challenge.id,
                        message: challenge.message,
                        difficulty: challenge.difficulty,
                        level: effort
                    }
                });
            }
            catch(err) {
                console.log(err);
                res.json({
                    status: 500,
                    message: `Internal server error.`,
                });
                return;
            }            
        }
        else {
            res.send({
                status: 403,
                message: `Please wait ${userCanClaim.remaining} minutes before claiming again.`
            });
            return;
        }        
    }
    else {
        res.send({
            status: 400,
            message: "Invalid address! Please verify if you entered your Zcash address correctly and try again."
        });
    }
});

app.post('/api/add', async (req, res) => {
    const userAddr = req.body.address;
    const userIp = getClientIp(req);
    const token = req.body.token;
    const tokenIsValid = await checkValidPoW(token);
    
    if(tokenIsValid) {                        
        // Add this claim to log file
        const timeStamp = new Date();
        logStream.write(`${timeStamp.toISOString()} | IP: ${new Date()} | Address: ${userAddr}\n\n`);

        try {
            await Claim.create({
                address: userAddr,
                ip: userIp,
                pending: true,                
            });
        }
        catch(err) {
            console.log(err);
            res.json({
                status: 500,
                message: `Internal server error.`,
            });
            return;
        }

        res.json({
            status: 200,
            message: `Success! Your address was added to the queue, in a few minutes you will receive ${u_payout} ${network == 'test' ? 'TAZ' : 'ZEC'}.`,
        });
    }
    else {
        res.send({
            status: 403,
            message: `Sorry, we couldn't verify you're not a robot.`
        });
        return;
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