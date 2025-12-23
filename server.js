// const { Worker } = require('worker_threads');

const express = require('express');
const bodyParser = require('body-parser')
const cors = require('cors')

const axios = require('axios');
const crypto = require('crypto');
const createPuzzle = require('node-puzzle');

const { verifySlider } = require('./verify_captcha');

const jwt = require('jsonwebtoken');

const https = require('https');
const fs = require('fs');
const path = require('path');

const dotenv = require('dotenv');
dotenv.config();

const lwd_url = process.env.LWD_URL;
const network = process.env.NETWORK;

const useHttps = process.env.USE_HTTPS === "true";
const checkVpn = process.env.CHECK_VPN === "true";
const blockVpn = process.env.BLOCK_VPN === "true";

const faucetClosed = process.env.FAUCET_CLOSED === "true";

const reCaptchaKey = process.env.RECAPTCHA_SECRET_KEY;
const useRecaptcha = process.env.USE_RECAPTCHA === "true";
const SECRET_KEY = process.env.JWT_SECRET_KEY; // Store securely in .env
const API_VOUCHER_TOKEN = process.env.API_VOUCHER_TOKEN;

const LiteWallet = require('./zingolib-wrapper/zingolib');
const { TxBuilder } = require('./zingolib-wrapper/utils/utils');
// const { join } = require('path');

const { initializeDatabase, Transaction, Claim, Challenge, Voucher, User } = require('./sequelize');
const { Op, fn, col, Sequelize } = require('sequelize');

const app = express();
const port = 2653;

// Set faucet payout in decimal ZEC (Mainnet / Testenet)
const u_payout = network == "main" ? 0.0005 : 0.3;
const z_payout = network == "main" ? 0.0004 : 0.2;
const t_payout = network == "main" ? 0.0003 : 0.1;

const memo = `Thanks for using ${network == 'test' ? 'testnet.' : ''}ZecFaucet.com`;

// Queue for the faucet payout
const waitTime = network == "main" ? 120 : 15; // Time in minuts before next claim
const payInterval = 3; // Time in minuts between payments
const minBlocks = 4; // Number of blocks to wait before sending payments
const scanInterval = 10; // Time in minutes to scan donations

let cooldown = false;

let latestHeight = 0;

// In-memory store for challenge puzzles
const store = new Map(); // id -> { x, expiresAt, width, height }

const BG_WIDTH = 320;
const BG_HEIGHT = 205;
// const TTL_MS = 2 * 60 * 1000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()) // to convert the request into JSON
app.use(cors()) // to allow cross origin requests
app.set("trust proxy", true);

// Setup zingolib
const zingo = new LiteWallet(lwd_url, network);

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

    latestHeight = zingo.lastWalletBlockHeight;

    // Send payments every `payInterval` minutes
    const timerID = setInterval(async() => {
        const currentHeight = zingo.lastWalletBlockHeight;
        const elapsedBlocks = currentHeight - latestHeight;
        // console.log("old height", latestHeight)
        // console.log("current height", currentHeight)
        console.log("elapsed", elapsedBlocks)
        
        if(elapsedBlocks < minBlocks) {
            console.log(`Awaiting ${minBlocks - elapsedBlocks} more blocks before sending payments ...`);
            return;
        }

        latestHeight = currentHeight;

        const sendProgress = zingo.isSending;        

        const queue = await Claim.findAll({
            where: {
                pending: true
            }
        });
        
        console.log(`Queue: ${queue.length} | Sending: ${sendProgress} | Synclock: ${zingo.syncLock}`);
        if(queue.length > 0 && !sendProgress && !zingo.syncLock) {
            const sendJson = (
                await Promise.all(queue.map(async (q) => {
                    let sendAmount = u_payout;
                    let sendMemo = memo;
                    
                    const voucher = await Voucher.findOne({ where: { id: q.voucherId} } );
                    if(voucher) {                                            
                        sendAmount = voucher.payout;
                        sendMemo = voucher.memo;
                    }
                    
                    const tx = new TxBuilder()
                        .setRecipient(q.address)
                        .setAmount(parseFloat(sendAmount))
                        .setMemo(sendMemo);

                    return tx.getSendJSON();
                }))
            ).flat();
            // console.log(sendJson);
            const sendJsonStr = JSON.stringify(sendJson);

            zingo.sendTransaction(sendJsonStr).then(async (txid)=>{
            // fakeSendTransaction(sendJson).then(async (txid)=>{                               
                console.log(txid);
                
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
            }).catch((err) => {
                console.log(err);
                // process.kill(process.pid, "SIGINT");
            });
        }  
    }, payInterval * 60 * 1000);    
    
    // Check new donations
    const donationsTimerId = setInterval(async () => {
        const sendProgress = zingo.isSending;
        const refreshing = zingo.inRefresh;
        if(sendProgress || refreshing) {
            console.log("Wallet sending or refreshing, skipping donation detection");
            return;
        }
        
        const lastDbTxid = await Transaction.findAll({
            where: { kind: 'received' },
            order: [['createdAt', 'DESC']],
            limit: 1
        });

        const lastTxid = zingo.fetchLastTxId();

        // console.log("db txid:", lastDbTxid[0].txid);
        // console.log("wallet txid:", lastTxid);

        if(lastTxid && lastDbTxid[0] && lastDbTxid[0].txid && lastDbTxid[0].txid != lastTxid) {                               
            console.log("Will start looking for new  donations ...")
            zingo.getTransactionsPromise().then(async (txSummaries) => {
                const walletTxns = txSummaries.value_transfers;
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
                            
                            if(tx.memos && tx.memos.length > 0) txMemo = tx.memos[0];

                            await Transaction.create({
                                txid: tx.txid,
                                kind: tx.kind,
                                value: tx.value,                            
                                memo: txMemo,
                                createdAt: txTimestamp
                            });
                            console.log(`New donation of ${tx.value / 10**8} received!\nMessage: ${txMemo}`);
                        }
                        catch(e) {
                            console.log("Couldn't insert donation into db ...");
                        }
                        count ++;
                    }
                }
            }).catch(e => { console.log(e) });
        }
        else {
            console.log("No new donation");           
        }
    }, scanInterval * 60 * 1000);
}).catch((err) => { console.log(err) });

function getClientIp(req) {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
        // x-forwarded-for can contain multiple IPs, take the first one
        return xForwardedFor.split(',')[0].trim();
    }
    return req.ip; // Fallback to req.ip if no x-forwarded-for header
};

app.get('/api/network', (req, res) =>{
    res.json({
        net: network,
        closed: faucetClosed
    });
});

app.get('/api/payout', async(req, res) =>{    
    const voucherIsValid = await checkValidVoucher(req.query.voucher);
    
    res.json({
        status: 200,
        payout: {
            u_pay: voucherIsValid.valid ? voucherIsValid.voucher.payout : u_payout,
            z_pay: z_payout,
            t_pay: t_payout
        }
    });
});

app.get('/api/donate', async (req, res) => {    
    const addr = await zingo.fetchAllAddresses();
    res.send(addr[0].encoded_address);
});

app.get('/api/balance', async (req, res) => {    
    const bal = zingo.totalSpendableBalance;
    return res.send(`${bal}`);
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

    const balance = zingo.totalSpendableBalance;

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
    const topDonations = await Transaction.findAll({
        where: { 
            kind: 'received',            
         },
        order: [['value', 'DESC']],
        limit: 3
    });

    const recentDonations = await Transaction.findAll({
        where: { 
            kind: 'received',
            value: {
                [Op.gte]: 50000
            }
         },
        order: [['createdAt', 'DESC']],
        limit: 7
    });

    // const donationsJson = recentDonations.map((el) => {
    //     return {
    //         'value': (el.value / 10**8),
    //         'time': el.createdAt,
    //         'memo': el.memo
    //     }
    // });
    const donationsJson = [];
    topDonations.forEach((el) => {
        donationsJson.push({
            value: (el.value / 10**8),
            time: el.createdAt,
            memo: el.memo
        });  
    });
    recentDonations.forEach((el) => {
        donationsJson.push({
            value: (el.value / 10**8),
            time: el.createdAt,
            memo: el.memo
        });  
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

app.get('/api/voucher', async (req, res) => { 
    const voucher = await checkValidVoucher(req.query.code);
    if(voucher.valid) {
        return res.json({
            status: 200,
            message: voucher.hint,
            value: voucher.voucher.payout
        });
    }
    res.json({
        status: 404,
        message: `This is not a valid voucher, or the voucher has expired.`,
        value: u_payout
    });
});

const canClaim = async (address, ip) => {
    // Check if user awaited `waitTime` (even if user is still in the queue)
    const cutoffTime = new Date(Date.now() - waitTime * 60 * 1000);
    
    let sequentialIp = '';
    const parts = ip.split('.');
    if (parts.length < 4) {
        sequentialIp = ip; // fallback, return original IP if unexpected format
    }
    const prefix = parts.slice(0, 2).join('.');

    sequentialIp = `${prefix}.%`;

    const recentClaim = await Claim.findOne({
        where: {
            [Op.or]: [
                { address },
                { ip },
                {
                  ip: {
                    [Op.like]: sequentialIp
                  }
                }
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
  
    console.log(`greedy user`);

    return {
        allowed: false,
        remaining: remainingMinutes
    };
};

const checkValidVoucher = async (voucherCode) => {        
    try {        
        const voucher = await Voucher.findOne({where: { code: voucherCode ? voucherCode.toUpperCase() : ''} });
        if(voucher) {
            const usageCount = await Claim.count({
                where: {
                  voucherId: voucher.id
                }
            });

            if (usageCount >= voucher.max_supply) {
                return {
                    valid: false,
                    hint: "This coupom is no longer available."
                };
            }

            return {
                valid: true,
                hint: `Your coupom is valid and will be applied to your claim!`,
                voucher: voucher
            };
        }
        else {
            throw(`Voucher not found: ${voucherCode}`)
        }
    }
    catch(err) {
        // console.log(err);
        return {
            valid: false,
            hint: err.toString()
        };
    }
}

const checkValidPoW = async (token, userIp) => {
    const nonce = token.nonce;
    
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

            const userIpChallenge = message.split('-')[1];
    
            // Block if user took too long to verify
            const challengeTimestamp = new Date(challenge.createdAt);
            const now = new Date();
            if (challengeTimestamp < now - 3 * 60 * 1000) {
                console.log(`User took too long to verify challenge id ${challenge.id}`);
                await challenge.destroy();
                return false;
            }

            // Block if IP address changed.
            if(userIpChallenge != userIp) {
                console.log(`IP mismatch. Claim was blocked for challenge ${challenge.id}!`);
                await challenge.destroy();
                return false;
            }

            const trial = message + nonce;
            const hash = hashMessage(trial);

            const hashesMatch = hash == token.hash;
            const hasMinZeros = hash.startsWith(minZeros);

            if(hashesMatch && hasMinZeros) {
                console.log(`Valid solution for proof of work for challenge id ${challenge.id}!`);
                await challenge.destroy();
                return true;
            }
            else {
                console.log(`Wrong hash for challenge id ${challenge.id}`);                
                await challenge.destroy();
                return false;
            }
        }       
    }
    catch(err) {
        console.log(err);
        return false;
    }

    console.log(`Failed to validate challenge.`);
    return false;
}

app.post('/api/challenge', async (req, res) => {
    // CHeck if it is a valid address
    const userAddr = req.body.address;
    const reCaptchaToken = req.body.token;
    const voucherIsValid = await checkValidVoucher(req.body.voucher);
    const puzzleId = req.body.puzzle;
    const puzzleSeed = req.body.seed;
    // console.log(puzzleId)
    // console.log(puzzleSeed)

    // Is slider captcha solved?
    const userPuzzle = store.get(puzzleId);
    if(userPuzzle && userPuzzle.solved) {
        console.log("Slider was completed!"); 
        // Also check id signature
        const userSig = puzzleId.split(".");
        
        if(userSig && userSig[1]) {
            if(Number(userSig[1]) < Date.now()) {
                console.log("Too slow to claim");
                store.delete(puzzleId);
                return res.send({
                    status: 403,
                    message: `Sorry, we couldn't verify you're not a robot.`
                });
            }

            const signature = crypto
                .createHmac('sha256', SECRET_KEY)
                .update(`${userSig[1]}-${puzzleSeed}`)
                .digest('base64url');
            if(signature === userSig[0]) {
                console.log("Correct signature");
            }
            else {
                console.log("Invalid signature");
                store.delete(puzzleId);
                return res.send({
                    status: 403,
                    message: `Sorry, we couldn't verify you're not a robot.`
                });
            }
        }
              
        store.delete(puzzleId);
    }
    else {
        console.log("Slider was bypassed!");       
        return res.send({
            status: 403,
            message: `Sorry, we couldn't verify you're not a robot.`
        }); 
    }

    // CHeck if faucet is closed for voucher holderd
    if(faucetClosed && !voucherIsValid.valid) {
        console.log("User without a voucher.");
        return res.send({
            status: 403,
            message: `The faucet is temporarily restricted to coupon holders. Come back soon!`
        });
    }

    const userIp = getClientIp(req);    
    let isVpn = false;
    let reScore = 1.0;

    const parsedAddr = await zingo.parseAddress(userAddr);
    let validAddr = false;
    if(network == "test") {
        validAddr = parsedAddr && parsedAddr.chain_name == network;
    }
    else {
        validAddr = parsedAddr && parsedAddr.chain_name == network && parsedAddr.address_kind == "unified";
    }
    if(validAddr) {
        const userCanClaim = await canClaim(userAddr, userIp);
        if (userCanClaim.allowed) {
            // Check if user is using proxy/vpn,            
            try {        
                const ipAddress = userIp.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)[0];
                const blacklisted = ['RU', 'ID', 'IN', 'VN', 'BG', 'RO'];

                // geolocation log
                const geo = await axios.get(`http://ip-api.com/json/${ipAddress}`);
                if(geo.data && geo.data.status == "success") {
                    const country = geo.data.country;
                    const regionName = geo.data.regionName;
                    const code = geo.data.countryCode;
                    // const isp = geo.data.isp;
                    if (blacklisted.includes(code)) {
                        console.log(`Blocked region detected: ${country} (${code})`);
                        return res.status(403).send({
                        status: 403,
                        message: `ZecFaucet is temporarily unavailable. Please try again later.`
                        });
                    }
                    console.log(`Country: ${country} | Region: ${regionName}`);
                }
                else {
                    console.log("No geolocation data.")
                }

                // Buf first of all, check reCaptcha v3 token
                const params = new URLSearchParams();
                params.append('secret', reCaptchaKey);
                params.append('response', reCaptchaToken);
                params.append('remoteip', ipAddress);
                const captcha = await axios.post("https://www.google.com/recaptcha/api/siteverify", params);                
                if(captcha.data.success && captcha.data.action == 'claim') {
                    reScore = captcha.data.score;
                    console.log(`User has a reCaptcha score of ${reScore}`);
                    // console.log(captcha.data)
                    if (useRecaptcha && reScore <= 0.3) {
                        console.log(`User blocked due to low score.`);
                        return res.send({
                            status: 403,
                            message: `Sorry, we couldn't verify you're not a robot.`
                        });                        
                    }
                }
                else {
                    console.log(`User blocked due to invalid captcha.`);
                    return res.send({
                        status: 403,
                        message: `Sorry, we couldn't verify you're not a robot.`
                    });                    
                }

                if(checkVpn) {
                    const proxyOrVpn = await axios.get(`http://check.getipintel.net/check.php?ip=${ipAddress}&contact=james.j.katz@protonmail.com`);
                    if(proxyOrVpn && proxyOrVpn.data > 0.90) {
                        console.log("VPN/Proxy detected.");
                        
                        // if(blockVpn && voucherIsValid.valid) {
                        //     return res.send({
                        //         status: 403,
                        //         message: `Please disable your VPN in order to use this coupon.`
                        //     });
                        // }
                                                
                        if(blockVpn) {
                            return res.send({
                                status: 403,
                                message: `Sorry, we couldn't verify you're not a robot.`
                            });
                        }
                        isVpn = true;
                    }
                }              
            }
            catch(err) {                
                console.log("Couldn't check user reCaptcha score or ip for proxy or vpn.");
            }
            
            // Then check if faucet has enough balance
            // TODO: Move to a separete function
            const bal = zingo.totalSpendableBalance;
            
            const pay = voucherIsValid.valid ? voucherIsValid.voucher.payout : u_payout;
            
            const queue = await Claim.findAll({
                where: {
                    pending: true
                }
            });
      
            // TODO improve this
            const queueSum = queue.length * u_payout;                
                
            const vouchers = await Voucher.findAll({ raw: true });

            let reservedBalance = 0;

            for (const voucher of vouchers) {
                const usedCount = await Claim.count({
                    where: { voucherId: voucher.id }
                });

                const remaining = Math.max(0, voucher.max_supply - usedCount);
                reservedBalance += remaining * voucher.payout;
            }

            
            console.log(`Faucet balance: ${bal}, Reserved balance: ${reservedBalance}, Queue sum: ${queueSum}, trying to add ${pay} to the queue`);

            const safeMargin = 0.005;
            
            if(!voucherIsValid.valid && bal - (queueSum + pay) < reservedBalance + safeMargin) {
                console.log("Balance is reserved for couponns holders.")
                return res.send({
                    status: 503,
                    message: `The faucet balance is reserved for coupon holders.`
                });                
            }

            if(bal - safeMargin < queueSum + pay) {
                return res.send({
                    status: 503,
                    message: `It looks like the faucet wallet don't have enough funds 🥹`
                });                
            }
            
            // If everything is ok, send the challenge to the user            
            try {  
                // Get faucet claims in the last hour
                let claimsPerHour = await Claim.count({
                    where: {
                        // pending: false,
                        createdAt: {
                            [Op.gte]: new Date(new Date() - 60 * 60 * 1000)
                        }
                    }
                });
                console.log(`Faucet claims/hour: ${claimsPerHour}`);
                
                if(claimsPerHour >= 8 || queue.length >= 3) cooldown = true;
                if(claimsPerHour <= 3) cooldown = false;

                // Global cooldown
                if(!voucherIsValid.valid && cooldown) {
                    console.log("Cooldown active");
                    return res.send({
                        status: 503,
                        message: `ZecFaucet is in cooldown mode due to high number of claims. Please try again later.`
                    });
                }

                // const base = isVpn ? 15 : 8;
                const base = network == 'test' ? 5 : 8;
                let baseDiff = Math.min(15, base + Math.floor(claimsPerHour / 4));

                // const reScoreCapped = Math.max(0.3, Math.min(1.0, reScore));
                // baseDiff += Math.round(((1.0 - reScoreCapped) / 0.7) * 3);
                
                // Get the total user claims (wallet address or IP)
                let userClaimCount = await Claim.count({
                    where: {
                        [Op.or]: [
                            { address: userAddr },
                            { ip: userIp }
                        ]
                    }
                });
                const extraZeros = Math.floor(userClaimCount / 20);
                const finalDiff = baseDiff + extraZeros;
                               
                const now = new Date().toLocaleTimeString('en-US').replace(/\s/g, '-');
                const msg = `${userAddr}-${userIp}-${now}` ;
                const challenge = await Challenge.create({
                    message: msg,
                    difficulty: finalDiff,                    
                });

                console.log(`New challenge: id: ${challenge.id}, difficulty: ${finalDiff}`);

                res.send({
                    status: 200,
                    message: {
                        id: challenge.id,
                        message: challenge.message,
                        difficulty: challenge.difficulty,
                        vpn: isVpn
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

app.post('/api/captcha/start', async (req, res) => {    
    try {
        const seed = req.body.seed || "";
        const timestamp = Date.now() + 30 * 1000;
        const signature = crypto
            .createHmac('sha256', SECRET_KEY)
            .update(`${timestamp}-${seed}`)
            .digest('base64url');
        const id = `${signature}.${timestamp}`;
        // console.log(id);
        
        const bgList = [
            "bg1.png", 
            "bg2.png", 
            "bg3.png",
            "bg4.png",
            "bg5.png",
        ];
        const pick = bgList[Math.floor(Math.random() * bgList.length)];

        const filePath = path.join(__dirname, 'assets', pick);
        const imgBuf = fs.readFileSync(filePath);
        const randomRGBA = () => {
            const r = Math.floor(Math.random() * 256);
            const g = Math.floor(Math.random() * 256);
            const b = Math.floor(Math.random() * 256);
            // const a = Math.random().toFixed(2); // alpha between 0.00 and 1.00
            const a = 0.7;
            return `rgba(${r},${g},${b},${a})`;
        } 

        const { bg, puzzle, x, y } = await createPuzzle(imgBuf, {
            width: 60,
            height: 60,            
            borderColor: `${randomRGBA()}`,
            fillColor: `${randomRGBA()}`,
            bgWidth: BG_WIDTH,
            bgHeight: BG_HEIGHT,
            imageWidth: BG_WIDTH,
            imageHeight: BG_HEIGHT,
            format: 'png',
            bgFormat: 'jpeg',            
        });
        
        // Check if id already exist somehow
        const row = store.get(id);
        if (row) throw("id_exist");
        
        store.set(id, { x, y, expiresAt: timestamp, seed });

        return res.json({
            id,
            bgUrl: `data:jpeg;base64,${bg.toString('base64')}`,
            puzzleUrl: `data:png;base64,${puzzle.toString('base64')}`,
        });
    }
    catch(err) {
        console.log(err)
        res.status(500).json({ error: 'captcha_init_failed' });
    }
});

app.post('/api/captcha/verify', async (req, res) => { 
    try {        
        const { id } = req.body;
        const row = store.get(id);
        if (!row) return res.json({ success: false, reason: 'not_found' });            
        if (row.expiresAt < new Date()) {
            console.log("Expired puzzle");
            store.delete(id);
            return res.json({ success: false, reason: 'expired' });
        }

        const verdict = verifySlider(row, req.body);
        
        if (!verdict.ok) {
            console.log(verdict.reason);
            // console.log(verdict.meta);
            store.delete(id);
            return res.json({ success: false, reason: verdict.reason });
        }

        store.set(id, { solved: true });
        
        return res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, reason: 'server_error' });
    }
});

// app.post('/api/captcha/verify', async (req, res) => {
//     try {
//         const { id} = req.body;
//         const row = store.get(id);
//         if (!row) return res.json({ success: false, reason: 'not_found' });
//         // if (row.expiresAt < Date.now()) return res.json({ success: false, reason: 'expired' });

//         const factor = Number(scale) || 1;
//         const expectedX = row.x * factor;
//         const ok = Math.abs(Number(clientX) - expectedX) <= TOLERANCE;

//         if (!ok) {
//             store.delete(id);
//             return res.json({ success: false, reason: 'mismatch' });
//         } 

//         store.set(id, {solved: true});
//         res.json({ success: true });
//     } catch (e) {
//         console.error('CAPTCHA /verify failed:', e);
//         res.status(500).json({ success: false, reason: 'server_error' });
//     }
// });

app.post('/api/add', async (req, res) => {
    const userAddr = req.body.address;
    const userIp = getClientIp(req);
    const token = req.body.token;
    const tokenIsValid = await checkValidPoW(token, userIp);
    const voucherIsValid = await checkValidVoucher(token.voucher);
    
    const userCanClaim = await canClaim(userAddr, userIp);
    if(!userCanClaim.allowed) {
        console.log("Double claim blocked!");
        return res.send({
            status: 403,
            message: `Please wait ${userCanClaim.remaining} minutes before claiming again.`
        });
    }

    if(tokenIsValid && userIp) {                        
        if(voucherIsValid.valid) {
            console.log(`Using voucher ${voucherIsValid.voucher.code}`);
        }

        try {
            await Claim.create({
                address: userAddr,
                ip: userIp,
                pending: true,
                voucherId: voucherIsValid.valid ? voucherIsValid.voucher.id : null
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
            message: `Success! Your address was added to the queue, in a few minutes you will receive ${voucherIsValid.valid ? voucherIsValid.voucher.payout : u_payout} ${network == 'test' ? 'TAZ' : 'ZEC'}.`,
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

// Auth middleware
const verifyToken = ((req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authorization header missing or malformed' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded; // attach user data to request        
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
});

const verifyApiToken = ((req, res, next) => {
    if (!API_VOUCHER_TOKEN) {
        return res.status(503).json({ message: 'API voucher token not configured' });
    }

    const token = req.headers['x-api-token'];
    if (!token || token !== API_VOUCHER_TOKEN) {
        return res.status(401).json({ message: 'Invalid API token' });
    }

    next();
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    const dbUser = await User.findOne({where:{username: username}});

    if (username === dbUser.username && password === dbUser.password) {
        console.log(`Correct credentials!`);
        const token = jwt.sign({ userId: dbUser.id }, SECRET_KEY, { expiresIn: '3h' });
        return res.json({ 
            username: dbUser.username,
            userId: dbUser.id,
            token: token 
        });
    }
  
    res.status(401).json({ message: 'Invalid credentials' });
});

// Voucher routes
app.get('/api/vouchers', verifyToken, async (req, res) => {
    try {        
        const vouchers = await Voucher.findAll({
            attributes: {
              include: [
                [Sequelize.fn('COUNT', Sequelize.col('claims.id')), 'usageCount']
              ]
            },
            include: [
              {
                model: Claim,
                attributes: [], // Just for counting usage
              },
              {
                model: User,
                attributes: ['username'] // or whatever field you want from the User
              }
            ],
            group: ['voucher.id', 'user.id'], // Important: group by both voucher and user
            order: [['createdAt', 'DESC']]
        });
        if(req.user.userId > 1) {
            return res.json(vouchers.filter((v) => v.userId === req.user.userId ));
        }
        res.json(vouchers);
    }
    catch(err) {
        // console.log(err);
        res.status(500).json({            
            message: 'Internal server error.'
        });
    }            
});

app.post('/api/vouchers/create', verifyToken, async (req, res) => {
    const data = req.body;
    
    try {        
        const user = await User.findOne({where: {id: req.user.userId}});
        await user.createVoucher({
            code: data.code.toUpperCase(),            
            payout: data.payout,
            memo: data.memo,
            max_supply: data.supply,
        });

        res.status(200).send();
    }
    catch(err) {
        // console.log(err)
        return res.status(500).json({            
            message: 'Internal server error.'
        });
    }            
});

app.post('/api/vouchers/create_from_api', verifyApiToken, async (req, res) => {
    // const { payout, memo, supply } = req.body;
    const payoutId = req.body.payId;
    const rawCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const voucherCode = `${rawCode.slice(0, 4)}-${rawCode.slice(4)}`;
    
    let payout = 0.0005;
    if(payoutId == 0) payout = 0.0006;
    else if(payoutId == 1 || payoutId == 2) payout = 0.0007;
    else if(payoutId == 3) payout = 0.0008;
    else if(payoutId == 4) payout = 0.0009;
    else if(payoutId == 5) payout = 0.001;

    const memo = "Thanks for being part of our Zcash Discord community."    

    try {
        const apiUser = await User.findOne({ where: { username: 'api' } });
        if (!apiUser) {
            return res.status(404).json({ message: 'API user not found' });
        }

        await apiUser.createVoucher({
            code: voucherCode,
            payout: payout,
            memo: memo,
            max_supply: 1,
        });

        res.status(200).json({ code: voucherCode });
    }
    catch(err) {
        return res.status(500).json({
            message: 'Internal server error.'
        });
    }
});

app.delete('/api/vouchers/delete/:id', verifyToken, async (req, res) => {
    const voucherId = req.params.id;
    
    try {
        await Voucher.destroy({where: {id: voucherId}});
        res.status(200).send();
    }
    catch(err) {
        // console.log(err);
        res.status(500).json({            
            message: 'Internal server error.'
        });
    }            
});

app.put('/api/vouchers/update', verifyToken, async (req, res) => {    
    const newValues = req.body;

    try {
        await Voucher.update(
            {
                payout: newValues.payout,
                memo: newValues.memo,
                max_supply: newValues.maxSupply
            },
            {where: {id: newValues.voucherId}
        });
        res.status(200).send();
    }
    catch(err) {
        // console.log(err);
        res.status(500).json({            
            message: 'Internal server error.'
        });
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
    await zingo.deinitialize();
    process.exit();
});
