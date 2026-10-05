// Formatting helpers for the offline landing page

export const formatZec = (value) => {
  const n = Number(value) || 0;
  const max = n === 0 ? 2 : n < 1 ? 6 : 4;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: max });
};

export const formatUsd = (value) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  if (n > 0 && n < 0.01) return '<$0.01';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatNumber = (value) => Math.round(Number(value) || 0).toLocaleString('en-US');

export const formatCompact = (value) =>
  (Number(value) || 0).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 4 });

export const formatDate = (value, opts = {}) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', ...opts });
};

const rtf = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat
  ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  : null;

export const formatRelative = (value) => {
  if (!value || !rtf) return '';
  const diffSec = (new Date(value).getTime() - Date.now()) / 1000;
  const units = [
    ['year', 31536000], ['month', 2592000], ['week', 604800],
    ['day', 86400], ['hour', 3600], ['minute', 60]
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(diffSec) >= secs) return rtf.format(Math.round(diffSec / secs), unit);
  }
  return 'just now';
};

export const shortTxid = (txid) => (txid && txid.length > 16 ? `${txid.slice(0, 8)}…${txid.slice(-6)}` : txid || '');

export const explorerUrl = (network, txid) =>
  `https://${network === 'test' ? 'testnet' : 'mainnet'}.zcashexplorer.app/transactions/${txid}`;
