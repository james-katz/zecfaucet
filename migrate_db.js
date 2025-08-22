const { Transaction, User, Voucher, initializeDatabase, resetDatabase } = require('./sequelize');
const LiteWallet = require('./zingolib-wrapper/zingolib');

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

    const lwd_url = process.env.LWD_URL;
    const network = process.env.NETWORK;

    // initialize zingolib
    const zingo = new LiteWallet(lwd_url, network, false);
    zingo.init().then(async () => {    
        // fetch all transactions
        const txList = await zingo.getTransactions();  
        const allTx = txList.value_transfers;

        console.log(`Processing a total of ${allTx.length} transactions.`)

        for(const tx of allTx) {
            const txTxid = tx.txid;
            const txTimestamp = new Date(tx.datetime * 1000);
            const txKind = tx.kind;
            const txValue = tx.value;
            const txFee = tx.fee;

            let txMemo = "No memo available";                            
            if(tx.memos && tx.memos.length > 0) txMemo = tx.memos[0];

            const txDb = await Transaction.create({
                txid: txTxid,
                kind: txKind,
                value: txValue,
                fee: txFee,
                memo: txMemo,
                createdAt: txTimestamp
            });
            
            if(txKind == "sent") {
                // const txClaims = tx.outgoing_tx_data;
                // for(const claim of txClaims) {
                    await txDb.createClaim({
                        address: tx.recipient_address,
                        ip: '0.0.0.0',
                        pending: false,
                        createdAt: txTimestamp
                    });
                // }
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
