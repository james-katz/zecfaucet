import { useCallback, useEffect, useState } from 'react';
import httpCommon from '../../http-common';
import logo from '../../images/zecfaucet_2.0.gif';
import ActivityChart from './ActivityChart';
import DonationsList from './DonationsList';
import useCountUp from './useCountUp';
import { formatZec, formatUsd, formatNumber, formatDate } from './format';
import {
  HeartIcon, SendIcon, DropletIcon, UsersIcon, TrendUpIcon, TrendDownIcon,
  RefreshIcon, AwardIcon, CalendarIcon, RepeatIcon,
} from './icons';
import './index.css';

function StatCard({ icon, label, value, format, sub, delay = 0, highlight = false }) {
  const animated = useCountUp(value);
  return (
    <div className={`ol-card ol-stat ${highlight ? 'is-highlight' : ''}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="ol-stat-icon">{icon}</div>
      <span className="ol-stat-label">{label}</span>
      <span className="ol-stat-value">{format(animated)}</span>
      {sub && <span className="ol-stat-sub">{sub}</span>}
    </div>
  );
}

function MiniStat({ icon, label, value }) {
  return (
    <div className="ol-mini">
      <span className="ol-mini-icon">{icon}</span>
      <div>
        <span className="ol-mini-label">{label}</span>
        <span className="ol-mini-value">{value}</span>
      </div>
    </div>
  );
}

function PriceChip({ price }) {
  if (!price) {
    return <span className="ol-chip ol-chip-muted">ZEC price unavailable</span>;
  }
  const change = price.change24h;
  const up = change !== null && change >= 0;
  return (
    <span className="ol-chip" title={`Source: ${price.source}${price.stale ? ' (cached)' : ''}`}>
      <span className="ol-chip-label">ZEC</span>
      <strong>{formatUsd(price.usd)}</strong>
      {change !== null && (
        <span className={`ol-change ${up ? 'is-up' : 'is-down'}`}>
          {up ? <TrendUpIcon size={13} /> : <TrendDownIcon size={13} />}
          {Math.abs(change).toFixed(2)}%
        </span>
      )}
      <span className="ol-chip-source">via {price.source}</span>
    </span>
  );
}

function SkeletonStats() {
  return (
    <div className="ol-stats-grid">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="ol-card ol-stat ol-stat-skeleton">
          <div className="ol-skel ol-skel-icon" />
          <div className="ol-skel ol-skel-line short" />
          <div className="ol-skel ol-skel-big" />
          <div className="ol-skel ol-skel-line" />
        </div>
      ))}
    </div>
  );
}

export default function OfflineLanding() {
  const [overview, setOverview] = useState(null);
  const [activity, setActivity] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const [ov, act] = await Promise.all([
        httpCommon.get('/public/overview'),
        httpCommon.get('/public/activity'),
      ]);
      setOverview(ov.data);
      setActivity(Array.isArray(act.data) ? act.data : []);
      setStatus('ready');
    }
    catch (err) {
      console.log(err);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    document.title = 'ZecFaucet · Faucet Stats & Community Donations';
    load();
  }, [load]);

  const coin = overview?.coin || 'ZEC';
  const network = overview?.network || 'main';
  const usd = overview?.price?.usd || null;
  const t = overview?.totals || {};
  const pctOf = (v) => (t.received > 0 ? Math.min(100, Math.max(0, ((v || 0) / t.received) * 100)) : 0);
  const sentPct = pctOf(t.sent);
  const feesPct = Math.min(100 - sentPct, pctOf(t.fees));
  const balance = t.balance ?? Math.max(0, (t.received || 0) - (t.sent || 0) - (t.fees || 0));
  // Share of donations that already left the wallet (payouts + network fees).
  const distributedPct = sentPct + feesPct;
  const toUsd = (zec) => (usd ? formatUsd(zec * usd) : null);

  return (
    <div className="ol-root">
      <div className="ol-bg" aria-hidden="true">
        <div className="ol-orb ol-orb-1" />
        <div className="ol-orb ol-orb-2" />
      </div>

      <header className="ol-nav">
        <div className="ol-container ol-nav-inner">
          <a className="ol-brand" href="/" aria-label="ZecFaucet home">
            <img src={logo} alt="" className="ol-brand-logo" />
            <span>Zec<strong>Faucet</strong></span>
          </a>
          <span className="ol-status" role="status">
            <span className="ol-status-dot" />
            Claims paused
          </span>
        </div>
      </header>

      <main className="ol-container">
        {/* ---------------- Hero ---------------- */}
        <section className="ol-hero" aria-labelledby="ol-title">
          <span className="ol-eyebrow"><DropletIcon size={14} /> Faucet temporarily offline</span>
          <h1 id="ol-title" className="ol-title">
            ZecFaucet is taking <span className="ol-gradient-text">a short break</span>
          </h1>
          <p className="ol-lead">
            Our wallet backend is offline right now, so new claims are paused. While we work on it,
            here&apos;s an open look at everything this community-funded faucet has done so far.
          </p>
          <div className="ol-hero-meta">
            {status === 'ready' && <PriceChip price={overview?.price} />}
            {status === 'ready' && overview?.dates?.firstActivity && (
              <span className="ol-chip ol-chip-muted">
                <CalendarIcon size={14} /> Dripping since {formatDate(overview.dates.firstActivity, { day: undefined })}
              </span>
            )}
            {status === 'ready' && network === 'test' && (
              <span className="ol-chip ol-chip-warn">Testnet · USD values shown at ZEC price for reference</span>
            )}
          </div>
        </section>

        {/* ---------------- Error ---------------- */}
        {status === 'error' && (
          <section className="ol-card ol-error">
            <h2>We&apos;ll be back soon</h2>
            <p>The faucet servers are unreachable at the moment. Please check back in a little while.</p>
            <button id="retry-load" className="ol-btn" onClick={load}>
              <RefreshIcon size={16} /> Try again
            </button>
          </section>
        )}

        {/* ---------------- Stats ---------------- */}
        {status === 'loading' && <SkeletonStats />}

        {status === 'ready' && (
          <>
            <section aria-label="Faucet totals">
              <div className="ol-stats-grid">
                <StatCard
                  highlight
                  delay={0}
                  icon={<HeartIcon />}
                  label="Total donated"
                  value={t.received}
                  format={(v) => <>{formatZec(v)} <small>{coin}</small></>}
                  sub={toUsd(t.received) ? `≈ ${toUsd(t.received)}` : `${formatNumber(t.donations)} donations`}
                />
                <StatCard
                  delay={80}
                  icon={<SendIcon />}
                  label="Total distributed"
                  value={t.sent}
                  format={(v) => <>{formatZec(v)} <small>{coin}</small></>}
                  sub={toUsd(t.sent) ? `≈ ${toUsd(t.sent)}` : `${formatNumber(t.payoutTransactions)} payout txs`}
                />
                <StatCard
                  delay={160}
                  icon={<DropletIcon />}
                  label="Claims served"
                  value={t.claims}
                  format={formatNumber}
                  sub={`across ${formatNumber(t.payoutTransactions)} payout transactions`}
                />
                <StatCard
                  delay={240}
                  icon={<UsersIcon />}
                  label="Unique recipients"
                  value={t.uniqueRecipients}
                  format={formatNumber}
                  sub="distinct Zcash addresses"
                />
              </div>

              <div className="ol-card ol-flow">
                <div className="ol-flow-head">
                  <div>
                    <h3 className="ol-card-title">Where the donations went</h3>
                    <p className="ol-card-sub">Every donated {coin}: dripped to the community, paid as network fees, or still in the faucet</p>
                  </div>
                  <span className="ol-flow-pct">{distributedPct.toFixed(1)}%</span>
                </div>
                <div className="ol-progress ol-progress-stacked" role="progressbar" aria-valuenow={Math.round(distributedPct)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="ol-progress-bar" style={{ width: `${sentPct}%` }} title={`Distributed ${formatZec(t.sent)} ${coin}`} />
                  <div className="ol-progress-bar ol-progress-bar-fees" style={{ width: `${feesPct}%` }} title={`Network fees ${formatZec(t.fees)} ${coin}`} />
                </div>
                <div className="ol-progress-legend">
                  <span><span className="ol-dot ol-dot-gold" /> Distributed {formatZec(t.sent)} {coin}</span>
                  <span><span className="ol-dot ol-dot-fees" /> Network fees {formatZec(t.fees)} {coin}</span>
                  <span><span className="ol-dot ol-dot-dim" /> Remaining {formatZec(balance)} {coin}</span>
                  <span>of {formatZec(t.received)} {coin} donated</span>
                </div>

                <div className="ol-mini-grid">
                  <MiniStat icon={<HeartIcon size={16} />} label="Donations" value={formatNumber(t.donations)} />
                  <MiniStat
                    icon={<AwardIcon size={16} />}
                    label="Largest donation"
                    value={<>{formatZec(t.largestDonation)} {coin}{usd ? <small> · {formatUsd(t.largestDonation * usd)}</small> : null}</>}
                  />
                  <MiniStat icon={<RepeatIcon size={16} />} label="Last payout" value={formatDate(overview?.dates?.lastPayout)} />
                  <MiniStat icon={<CalendarIcon size={16} />} label="Last donation" value={formatDate(overview?.dates?.lastDonation)} />
                </div>
              </div>
            </section>

            {/* ---------------- Chart ---------------- */}
            <section className="ol-section" aria-labelledby="activity-title">
              <div className="ol-section-head">
                <div>
                  <span className="ol-eyebrow"><SendIcon size={14} /> History</span>
                  <h2 id="activity-title" className="ol-section-title">Faucet operation</h2>
                  <p className="ol-section-sub">How much {coin} the faucet dripped over time.</p>
                </div>
              </div>
              <ActivityChart activity={activity} coin={coin} price={usd} />
            </section>

            {/* ---------------- Donations ---------------- */}
            <DonationsList coin={coin} network={network} price={usd} totalCount={t.donations} />
          </>
        )}
      </main>

      <footer className="ol-footer">
        <div className="ol-container ol-footer-inner">
          <p>
            Thank you to every donor who keeps Zcash accessible. <HeartIcon size={14} className="ol-heart" />
          </p>
          <p className="ol-footer-note">
            Fiat values use the current ZEC price, not the price at the time of each transaction.
            {overview?.price?.updatedAt && <> Updated {new Date(overview.price.updatedAt).toLocaleTimeString('en-US')}.</>}
          </p>
        </div>
      </footer>
    </div>
  );
}
