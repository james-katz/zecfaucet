import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { formatZec, formatUsd, formatNumber, formatCompact } from './format';

const DAY = 24 * 60 * 60 * 1000;

const PERIODS = [
  { key: '30d', label: '30D', days: 30 },
  { key: '90d', label: '90D', days: 90 },
  { key: '1y', label: '1Y', days: 365 },
  { key: 'all', label: 'All', days: null },
];

// ---- UTC date bucketing helpers -------------------------------------------
const toUtcDay = (isoDate) => Date.parse(`${isoDate}T00:00:00Z`);

const todayUtc = () => {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

const bucketStart = (ts, bucket) => {
  const d = new Date(ts);
  if (bucket === 'day') return ts;
  if (bucket === 'week') return ts - ((d.getUTCDay() + 6) % 7) * DAY; // Monday
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
};

const nextBucket = (ts, bucket) => {
  if (bucket === 'day') return ts + DAY;
  if (bucket === 'week') return ts + 7 * DAY;
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
};

const tickLabel = (ts, bucket) =>
  new Date(ts).toLocaleDateString('en-US', bucket === 'month'
    ? { month: 'short', year: '2-digit', timeZone: 'UTC' }
    : { month: 'short', day: 'numeric', timeZone: 'UTC' });

const tooltipLabel = (ts, bucket) => {
  const full = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
  if (bucket === 'month') return new Date(ts).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  if (bucket === 'week') return `Week of ${new Date(ts).toLocaleDateString('en-US', full)}`;
  return new Date(ts).toLocaleDateString('en-US', { weekday: 'short', ...full });
};

function buildSeries(activity, period) {
  const end = todayUtc();
  let start;
  if (period.days) {
    start = end - (period.days - 1) * DAY;
  }
  else {
    start = activity.length ? Math.min(toUtcDay(activity[0].date), end) : end - 29 * DAY;
  }

  const spanDays = (end - start) / DAY;
  const bucket = spanDays <= 92 ? 'day' : spanDays <= 400 ? 'week' : 'month';

  const buckets = new Map();
  for (let t = bucketStart(start, bucket); t <= end; t = nextBucket(t, bucket)) {
    buckets.set(t, { ts: t, sent: 0, claims: 0, received: 0, txs: 0 });
  }

  activity.forEach((row) => {
    const ts = toUtcDay(row.date);
    if (Number.isNaN(ts) || ts < start || ts > end) return;
    const b = buckets.get(bucketStart(ts, bucket));
    if (!b) return;
    b.sent += row.sent || 0;
    b.claims += row.claims || 0;
    b.received += row.received || 0;
    b.txs += row.txs || 0;
  });

  return { bucket, points: [...buckets.values()] };
}

function ChartTooltip({ active, payload, bucket, coin, price }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="ol-tooltip">
      <div className="ol-tooltip-title">{tooltipLabel(p.ts, bucket)}</div>
      <div className="ol-tooltip-row">
        <span className="ol-dot ol-dot-gold" />
        <span>Sent</span>
        <strong>{formatZec(p.sent)} {coin}</strong>
      </div>
      {price ? <div className="ol-tooltip-sub">≈ {formatUsd(p.sent * price)}</div> : null}
      <div className="ol-tooltip-row">
        <span className="ol-dot ol-dot-light" />
        <span>Claims</span>
        <strong>{formatNumber(p.claims)}</strong>
      </div>
      <div className="ol-tooltip-row">
        <span className="ol-dot ol-dot-green" />
        <span>Donations</span>
        <strong>{formatZec(p.received)} {coin}</strong>
      </div>
    </div>
  );
}

export default function ActivityChart({ activity, coin, price }) {
  const [periodKey, setPeriodKey] = useState('90d');
  const [metric, setMetric] = useState('sent');

  const metrics = [
    { key: 'sent', label: `${coin} sent` },
    { key: 'claims', label: 'Claims' },
    { key: 'received', label: 'Donations' },
  ];

  const period = PERIODS.find((p) => p.key === periodKey) || PERIODS[1];
  const { bucket, points } = useMemo(() => buildSeries(activity || [], period), [activity, period]);

  const totals = useMemo(() => points.reduce((acc, p) => ({
    sent: acc.sent + p.sent,
    claims: acc.claims + p.claims,
    received: acc.received + p.received,
    txs: acc.txs + p.txs,
  }), { sent: 0, claims: 0, received: 0, txs: 0 }), [points]);

  const isEmpty = totals[metric] === 0;
  const barColor = metric === 'received' ? 'url(#olBarGreen)' : metric === 'claims' ? 'url(#olBarLight)' : 'url(#olBarGold)';
  const bucketLabel = bucket === 'day' ? 'daily' : bucket === 'week' ? 'weekly' : 'monthly';

  return (
    <div className="ol-card ol-chart-card">
      <div className="ol-card-head">
        <div>
          <h3 className="ol-card-title">Faucet activity</h3>
          <p className="ol-card-sub">Amounts aggregated {bucketLabel} (UTC)</p>
        </div>
        <div className="ol-chart-controls">
          <div className="ol-segment" role="tablist" aria-label="Chart metric">
            {metrics.map((m) => (
              <button
                key={m.key}
                id={`chart-metric-${m.key}`}
                role="tab"
                aria-selected={metric === m.key}
                className={`ol-segment-btn ${metric === m.key ? 'is-active' : ''}`}
                onClick={() => setMetric(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="ol-segment" role="tablist" aria-label="Chart period">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                id={`chart-period-${p.key}`}
                role="tab"
                aria-selected={periodKey === p.key}
                className={`ol-segment-btn ${periodKey === p.key ? 'is-active' : ''}`}
                onClick={() => setPeriodKey(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="ol-chart-summary">
        <div>
          <span className="ol-summary-label">Sent in period</span>
          <span className="ol-summary-value">{formatZec(totals.sent)} <small>{coin}</small></span>
          {price ? <span className="ol-summary-usd">≈ {formatUsd(totals.sent * price)}</span> : null}
        </div>
        <div>
          <span className="ol-summary-label">Claims served</span>
          <span className="ol-summary-value">{formatNumber(totals.claims)}</span>
          <span className="ol-summary-usd">{formatNumber(totals.txs)} payout txs</span>
        </div>
        <div>
          <span className="ol-summary-label">Donations received</span>
          <span className="ol-summary-value">{formatZec(totals.received)} <small>{coin}</small></span>
          {price ? <span className="ol-summary-usd">≈ {formatUsd(totals.received * price)}</span> : null}
        </div>
      </div>

      <div className="ol-chart-wrap">
        {isEmpty && <div className="ol-chart-empty">No activity recorded in this period</div>}
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={points} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="olBarGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFD46B" />
                <stop offset="100%" stopColor="#E8A317" stopOpacity={0.55} />
              </linearGradient>
              <linearGradient id="olBarLight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFF1C9" />
                <stop offset="100%" stopColor="#F4B728" stopOpacity={0.45} />
              </linearGradient>
              <linearGradient id="olBarGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7EE2A8" />
                <stop offset="100%" stopColor="#2F9E64" stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="ts"
              tickFormatter={(ts) => tickLabel(ts, bucket)}
              stroke="rgba(255,255,255,0.35)"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              minTickGap={24}
            />
            <YAxis
              stroke="rgba(255,255,255,0.35)"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={56}
              allowDecimals={metric !== 'claims'}
              tickFormatter={(v) => formatCompact(v)}
            />
            <Tooltip
              cursor={{ fill: 'rgba(244,183,40,0.08)' }}
              content={<ChartTooltip bucket={bucket} coin={coin} price={price} />}
            />
            <Bar
              dataKey={metric}
              fill={barColor}
              radius={[6, 6, 0, 0]}
              maxBarSize={36}
              animationDuration={700}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
