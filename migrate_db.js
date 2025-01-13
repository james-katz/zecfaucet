const { Transaction, resetDatabase } = require('./sequelize');
const LiteWallet = require('./zingolib-wrapper/zingolib');

async function migrate_db() {
    console.log("Migrating db");
    await resetDatabase();

    const dotenv = require('dotenv');
    dotenv.config();

    const lwd_url = process.env.LWD_URL;

    // initialize zingolib
    const zingo = new LiteWallet(lwd_url, "main", false);
    zingo.init().then(async () => {    
        // fetch all transactions
        const txList = zingo.getTransactionsSummaries();  
        const allTx = txList.transaction_summaries;

        console.log(`Processing a total of ${allTx.length} transactions.`)

        for(const tx of allTx) {
            const txTxid = tx.txid;
            const txTimestamp = new Date(tx.datetime * 1000);
            const txKind = tx.kind;
            const txValue = tx.value;
            const txFee = tx.fee;

            let txMemo = "No memo available";
            if(tx.orchard_notes[0] && tx.orchard_notes[0].memo != null) {
                txMemo = tx.orchard_notes[0].memo;
            }
            else if(tx.sapling_notes[0] && tx.sapling_notes[0].memo != null) {
                txMemo = tx.sapling_notes[0].memo;
            }

            const txDb = await Transaction.create({
                txid: txTxid,
                kind: txKind,
                value: txValue,
                fee: txFee,
                memo: txMemo,
                createdAt: txTimestamp
            });
            
            if(txKind == "sent") {
                const txClaims = tx.outgoing_tx_data;
                for(const claim of txClaims) {
                    await txDb.createClaim({
                        address: claim.address,
                        createdAt: txTimestamp
                    });
                }
            }
        }
        console.log("Done!");
        process.exit();
    }).catch((err) => { console.log(err) });
}

migrate_db();
