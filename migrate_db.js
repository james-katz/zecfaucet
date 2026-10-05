/**
 * Rebuild the `transactions` and `claims` tables from the Zkool wallet history.
 *
 * Usage (stop server.js first so nothing else hammers Zkool / the DB):
 *   node migrate_db.js                 # full migration
 *   node migrate_db.js --dry-run       # fetch + compute, print a summary, write nothing
 *   node migrate_db.js --inspect TXID  # print raw Zkool data for one transaction
 *
 * Env:
 *   GQL_URL               Zkool GraphQL endpoint (required)
 *   MIGRATE_CONCURRENCY   parallel Zkool requests (default 4; lower it if Zkool
 *                         reports "pool timed out")
 *   SEED_USERNAME / SEED_PASSWORD   only used to create missing default users
 *
 * Safety:
 *   - Everything is fetched from Zkool BEFORE the database is touched. If any
 *     transaction can't be fetched, the script aborts and the DB is unchanged.
 *   - A timestamped backup of the SQLite file is written before any change.
 *   - Users and vouchers are kept with their original ids, so voucher ownership
 *     and the `api` user survive.
 *   - Existing claim metadata (ip, voucherId) is carried over, so voucher usage
 *     counts don't reset. Pending (queued) claims are kept as they are.
 */
const fs = require('fs');
const path = require('path');

const { sequelize, Transaction, Claim, User, Voucher, initializeDatabase, resetDatabase } = require('./sequelize');
const { ZkoolClient } = require('./zkool');

const dotenv = require('dotenv');
dotenv.config();

const CONCURRENCY = Math.max(1, parseInt(process.env.MIGRATE_CONCURRENCY, 10) || 4);
const MAX_RETRIES = 6;
const CHUNK_SIZE = 1000;
const NO_MEMO = 'No memo available';
const DEFAULT_USERS = ['zechub', 'zkavclub', 'ecc'];

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const INSPECT_TXID = args.includes('--inspect') ? args[args.indexOf('--inspect') + 1] : null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(fn, label) {
    for (let attempt = 1; ; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            if (attempt >= MAX_RETRIES) throw err;
            const delay = Math.min(15000, 500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 300);
            const reason = (err?.message || String(err)).split('\n')[0].slice(0, 120);
            console.log(`  retry ${attempt}/${MAX_RETRIES - 1} for ${label} in ${delay}ms (${reason})`);
            await sleep(delay);
        }
    }
}

// Run `fn` over `items` with at most `limit` promises in flight.
async function mapWithConcurrency(items, limit, fn, onProgress) {
    const results = new Array(items.length);
    let next = 0;
    let done = 0;

    const worker = async () => {
        while (true) {
            const i = next++;
            if (i >= items.length) return;
            results[i] = await fn(items[i], i);
            done++;
            if (onProgress) onProgress(done);
        }
    };

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

const progressLogger = (total) => {
    const started = Date.now();
    return (done) => {
        if (done % 500 !== 0 && done !== total) return;
        const elapsed = (Date.now() - started) / 1000;
        const rate = done / Math.max(elapsed, 0.001);
        const eta = Math.round((total - done) / Math.max(rate, 0.001));
        console.log(`  ${done}/${total} (${((done / total) * 100).toFixed(1)}%) · ${rate.toFixed(1)} tx/s · ETA ${eta}s`);
    };
};

const chunk = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

const firstMemo = (entries) => {
    const hit = (entries || []).find((e) => typeof e?.memo === 'string' && e.memo.trim() !== '');
    return hit ? hit.memo : null;
};

// ---------------------------------------------------------------------------
// Transform Zkool data into DB rows
// ---------------------------------------------------------------------------

function buildRows(txList, details, ownAddresses) {
    const transactions = [];
    const claims = [];
    const stats = { received: 0, sent: 0, internal: 0, claims: 0, valueFallbacks: 0 };

    txList.forEach((tx, i) => {
        const info = details[i] || {};
        const netValue = Number(tx.value) || 0;
        const fee = Number(tx.fee) || 0;
        const createdAt = new Date(tx.time);

        if (netValue > 0) {
            // Incoming funds (donation)
            transactions.push({
                txid: tx.txid,
                kind: 'received',
                value: netValue,
                fee: fee,
                memo: firstMemo(info.notes) || NO_MEMO,
                createdAt
            });
            stats.received++;
            return;
        }

        // Outgoing: only outputs to someone else are payouts. Outputs back to the
        // faucet (change, shielding, self-transfers) are not claims.
        const external = (info.outputs || []).filter((o) => o?.address && !ownAddresses.has(o.address));

        if (external.length === 0) {
            // Shielding / self-transfer / zero-value tx: keep it, but out of the stats
            transactions.push({
                txid: tx.txid,
                kind: 'internal',
                value: Math.abs(netValue),
                fee: fee,
                memo: NO_MEMO,
                createdAt
            });
            stats.internal++;
            return;
        }

        // Prefer the sum of payout outputs (excludes fee and change); fall back to
        // the net value if the outputs don't look consistent with it.
        const outputsSum = external.reduce((acc, o) => acc + (Number(o.value) || 0), 0);
        const sane = outputsSum > 0 && outputsSum <= Math.abs(netValue) + 1e-8;
        if (!sane) stats.valueFallbacks++;

        transactions.push({
            txid: tx.txid,
            kind: 'sent',
            value: sane ? outputsSum : Math.abs(netValue),
            fee: fee,
            memo: firstMemo(external) || NO_MEMO,
            createdAt
        });
        stats.sent++;

        external.forEach((o) => {
            claims.push({
                address: o.address,
                ip: '0.0.0.0',
                pending: false,
                transactionTxid: tx.txid,
                createdAt
            });
        });
        stats.claims += external.length;
    });

    return { transactions, claims, stats };
}

// Carry ip / voucherId from existing claims over to the rebuilt ones, and keep
// claims that can't be rebuilt from the wallet (pending queue, failed sends).
function mergeClaims(newClaims, oldClaims, newTxids) {
    const oldByKey = new Map();
    const leftovers = [];

    oldClaims.forEach((c) => {
        if (c.transactionTxid && newTxids.has(c.transactionTxid)) {
            const key = `${c.transactionTxid}|${c.address}`;
            if (!oldByKey.has(key)) oldByKey.set(key, []);
            oldByKey.get(key).push(c);
        }
        else {
            leftovers.push(c);
        }
    });

    let restored = 0;
    const merged = newClaims.map((c) => {
        const bucket = oldByKey.get(`${c.transactionTxid}|${c.address}`);
        const old = bucket && bucket.shift();
        if (!old) return c;
        restored++;
        return { ...c, ip: old.ip || c.ip, voucherId: old.voucherId ?? null };
    });

    // Old claims that matched a tx but had no counterpart output: keep them so
    // voucher usage stays correct.
    oldByKey.forEach((bucket) => bucket.forEach((c) => leftovers.push(c)));

    const kept = leftovers.map((c) => ({
        address: c.address,
        ip: c.ip,
        pending: c.pending,
        voucherId: c.voucherId ?? null,
        transactionTxid: c.transactionTxid && newTxids.has(c.transactionTxid) ? c.transactionTxid : null,
        createdAt: c.createdAt
    }));

    return { claims: merged.concat(kept), restored, kept: kept.length };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function inspect(zkool, txid) {
    const list = await zkool.getTransactions();
    const entry = list.find((t) => t.txid === txid);
    const info = await zkool.fetchTransactionInfo(zkool.accountId, txid);
    const addr = await zkool.getAddress();
    console.log(JSON.stringify({ ownAddresses: addr, listEntry: entry || null, details: info }, null, 2));
}

async function migrate_db() {
    const gqlUrl = process.env.GQL_URL;
    if (!gqlUrl) throw new Error('GQL_URL is not set');

    // Don't spawn the background sync: it competes for Zkool's connection pool.
    const zkool = new ZkoolClient(gqlUrl);
    const ready = await zkool.init(false);
    if (!ready) throw new Error(`Zkool backend not reachable at ${gqlUrl}`);

    if (INSPECT_TXID) {
        await inspect(zkool, INSPECT_TXID);
        return;
    }

    console.log(`Migrating db${DRY_RUN ? ' (dry run)' : ''} · concurrency ${CONCURRENCY}`);

    // 1. Fetch everything from Zkool (DB untouched so far)
    const address = await zkool.getAddress();
    const ownAddresses = new Set(
        [address.ua, address.orchard, address.sapling, address.transparent].filter(Boolean)
    );
    if (ownAddresses.size === 0) throw new Error('Could not fetch faucet addresses from Zkool');

    const rawList = await zkool.getTransactions();
    if (!rawList.length) throw new Error('Zkool returned no transactions (or the request failed); aborting');
    const seen = new Set();
    const txList = rawList.filter((tx) => tx?.txid && !seen.has(tx.txid) && seen.add(tx.txid));
    console.log(`Fetching details for ${txList.length} transactions ...`);

    const failed = [];
    const details = await mapWithConcurrency(
        txList,
        CONCURRENCY,
        async (tx) => {
            try {
                return await withRetry(() => zkool.fetchTransactionInfo(zkool.accountId, tx.txid), tx.txid);
            }
            catch (err) {
                failed.push(tx.txid);
                return null;
            }
        },
        progressLogger(txList.length)
    );

    if (failed.length) {
        console.log(`Failed to fetch ${failed.length} transaction(s), e.g. ${failed.slice(0, 5).join(', ')}`);
        throw new Error('Aborting: database left untouched. Retry with a lower MIGRATE_CONCURRENCY.');
    }

    // 2. Build rows
    const { transactions, claims: rebuiltClaims, stats } = buildRows(txList, details, ownAddresses);

    await initializeDatabase();
    const [users, vouchers, oldClaims] = await Promise.all([
        User.findAll({ raw: true }),
        Voucher.findAll({ raw: true }),
        Claim.findAll({ raw: true })
    ]);

    const newTxids = new Set(transactions.map((t) => t.txid));
    const { claims, restored, kept } = mergeClaims(rebuiltClaims, oldClaims, newTxids);

    const sum = (kind) => transactions.filter((t) => t.kind === kind).reduce((a, t) => a + t.value, 0);
    console.log('Summary:');
    console.log(`  received: ${stats.received} txs, ${sum('received').toFixed(8)} ZEC`);
    console.log(`  sent:     ${stats.sent} txs, ${sum('sent').toFixed(8)} ZEC (${stats.valueFallbacks} used net value fallback)`);
    console.log(`  internal: ${stats.internal} txs (shielding / self-transfers, excluded from stats)`);
    console.log(`  claims:   ${stats.claims} rebuilt, ${restored} with restored ip/voucher, ${kept} kept from old DB`);
    console.log(`  users: ${users.length}, vouchers: ${vouchers.length}`);

    if (DRY_RUN) {
        console.log('Dry run: nothing written.');
        return;
    }

    // 3. Backup, then rewrite the DB in one SQLite transaction
    const storage = path.resolve(sequelize.options.storage);
    const backup = `${storage}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.copyFileSync(storage, backup);
    console.log(`Backup written to ${backup}`);

    try {
        await resetDatabase();
        await sequelize.transaction(async (t) => {
            const opts = { transaction: t, logging: false };
            if (users.length) await User.bulkCreate(users, opts);
            if (vouchers.length) await Voucher.bulkCreate(vouchers, opts);
            for (const part of chunk(transactions, CHUNK_SIZE)) await Transaction.bulkCreate(part, opts);
            for (const part of chunk(claims, CHUNK_SIZE)) await Claim.bulkCreate(part, opts);

            // Create default users only if they don't exist yet
            const seedUser = process.env.SEED_USERNAME;
            const seedPwd = process.env.SEED_PASSWORD;
            if (seedUser && seedPwd) {
                for (const username of [seedUser, ...DEFAULT_USERS]) {
                    await User.findOrCreate({ where: { username }, defaults: { password: seedPwd }, transaction: t });
                }
            }
        });
    }
    catch (err) {
        console.log(`Write failed. Restore the previous DB with:\n  cp "${backup}" "${storage}"`);
        throw err;
    }

    console.log(`Done! ${transactions.length} transactions and ${claims.length} claims written.`);
}

if (require.main === module) {
    const started = Date.now();
    migrate_db()
        .then(() => {
            console.log(`Finished in ${((Date.now() - started) / 1000).toFixed(1)}s`);
            process.exit(0);
        })
        .catch((err) => {
            console.error(err.message || err);
            process.exit(1);
        });
}

module.exports = { migrate_db, buildRows, mergeClaims, mapWithConcurrency };
