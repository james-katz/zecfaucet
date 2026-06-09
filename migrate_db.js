const { Transaction, User, Voucher, initializeDatabase, resetDatabase } = require('./sequelize');
const { ZkoolClient } = require('./zkool');

const dotenv = require('dotenv');
dotenv.config();

async function migrate_db() {
    console.log("Migrating db");
    
    await initializeDatabase();
    // Save existing vouchers
    const vouchers = await Voucher.findAll({ raw: true });
    
    await resetDatabase();

    const seedUser = process.env.SEED_USERNAME;
    const seedPwd = process.env.SEED_PASSWORD;

    const gql_url = process.env.GQL_URL;
    // const network = process.env.NETWORK;

    // initialize zkool
    const zkool = new ZkoolClient(gql_url);
    zkool.init().then(async () => {    
        // fetch all transactions
        const txList = await zkool.getTransactions();          

        console.log(`Processing a total of ${txList.length} transactions.`)

        for(const tx of txList) {
            const txTxid = tx.txid;
            const txTimestamp = new Date(tx.time);
            const txKind = tx.value >= 0 ? "received" : "sent";
            const txValue = Math.abs(tx.value);
            const txFee = tx.fee;                         
            let txMemo = "No memo available";
            
            const txDetails = await zkool.getTransactionInfo(zkool.accountId, txTxid);

            if(txKind === "received") {                
                if(txDetails.notes &&
                    txDetails.notes.length > 0 &&
                    txDetails.notes[0].memo) {
                        txMemo = txDetails.notes[0].memo;
                }                
            }
            
            const txDb = await Transaction.create({
                txid: txTxid,
                kind: txKind,
                value: txValue,
                fee: txFee,
                memo: txMemo,
                createdAt: txTimestamp
            });

            if(txKind === "sent") {
                const txClaims = txDetails.outputs;
                for(const claim of txClaims) {
                    await txDb.createClaim({
                        address: claim.address,
                        ip: '0.0.0.0',
                        pending: false,
                        createdAt: txTimestamp
                    });
                }
            }
        }
              
        await User.create({
            username: seedUser,
            password: seedPwd
        });

        await User.create({
            username: 'zechub',
            password: seedPwd
        });

        await User.create({
            username: 'zkavclub',
            password: seedPwd
        });

        await User.create({
            username: 'ecc',
            password: seedPwd
        });

        // Re-insert vouchers
        for (const v of vouchers) {
            await Voucher.create({
                code: v.code,
                payout: v.payout,
                memo: v.memo,
                max_supply: v.max_supply,
                userId: v.userId,
                createdAt: v.createdAt,
                updatedAt: v.updatedAt
            });
        }

        console.log("Done!");
        process.exit();
    }).catch((err) => { console.log(err) });
}

migrate_db();
