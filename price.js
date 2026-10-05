const axios = require('axios');

// Current ZEC/USD spot price with multiple providers and an in-memory cache.
// Providers are tried in order; the first valid answer wins.

const CACHE_TTL_MS = 5 * 60 * 1000;      // refresh at most every 5 minutes
const REQUEST_TIMEOUT_MS = 6 * 1000;

let cache = null; // { usd, change24h, source, updatedAt }
let inflight = null;

const providers = [
    {
        name: 'CoinGecko',
        fetch: async () => {
            const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
                params: { ids: 'zcash', vs_currencies: 'usd', include_24hr_change: 'true' },
                timeout: REQUEST_TIMEOUT_MS
            });
            return { usd: data?.zcash?.usd, change24h: data?.zcash?.usd_24h_change };
        }
    },
    {
        name: 'Kraken',
        fetch: async () => {
            const { data } = await axios.get('https://api.kraken.com/0/public/Ticker', {
                params: { pair: 'ZECUSD' },
                timeout: REQUEST_TIMEOUT_MS
            });
            const ticker = data?.result ? Object.values(data.result)[0] : null;
            const last = ticker ? parseFloat(ticker.c?.[0]) : NaN;
            const open = ticker ? parseFloat(ticker.o) : NaN;
            return {
                usd: last,
                change24h: Number.isFinite(open) && open > 0 ? ((last - open) / open) * 100 : null
            };
        }
    },
    {
        name: 'CryptoCompare',
        fetch: async () => {
            const { data } = await axios.get('https://min-api.cryptocompare.com/data/pricemultifull', {
                params: { fsyms: 'ZEC', tsyms: 'USD' },
                timeout: REQUEST_TIMEOUT_MS
            });
            const raw = data?.RAW?.ZEC?.USD;
            return { usd: raw?.PRICE, change24h: raw?.CHANGEPCT24HOUR };
        }
    },
    {
        name: 'Binance',
        fetch: async () => {
            const { data } = await axios.get('https://api.binance.com/api/v3/ticker/24hr', {
                params: { symbol: 'ZECUSDT' },
                timeout: REQUEST_TIMEOUT_MS
            });
            return { usd: parseFloat(data?.lastPrice), change24h: parseFloat(data?.priceChangePercent) };
        }
    }
];

const fetchFromProviders = async () => {
    for (const provider of providers) {
        try {
            const { usd, change24h } = await provider.fetch();
            const price = Number(usd);
            if (Number.isFinite(price) && price > 0) {
                return {
                    usd: price,
                    change24h: Number.isFinite(Number(change24h)) ? Number(change24h) : null,
                    source: provider.name,
                    updatedAt: new Date().toISOString()
                };
            }
        }
        catch (err) {
            console.log(`[price] ${provider.name} failed: ${err.message}`);
        }
    }
    return null;
};

/**
 * Returns the current ZEC price in USD.
 * Falls back to the last known (stale) value if every provider fails.
 * @returns {Promise<{usd:number, change24h:number|null, source:string, updatedAt:string, stale?:boolean}|null>}
 */
const getZecPrice = async () => {
    if (cache && Date.now() - new Date(cache.updatedAt).getTime() < CACHE_TTL_MS) {
        return cache;
    }

    // Deduplicate concurrent refreshes
    if (!inflight) {
        inflight = fetchFromProviders().finally(() => { inflight = null; });
    }

    const fresh = await inflight;
    if (fresh) {
        cache = fresh;
        return cache;
    }

    return cache ? { ...cache, stale: true } : null;
};

module.exports = { getZecPrice };
