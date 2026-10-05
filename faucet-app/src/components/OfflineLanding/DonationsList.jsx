import { useEffect, useState } from 'react';
import httpCommon from '../../http-common';
import { formatZec, formatUsd, formatDate, formatRelative, shortTxid, explorerUrl } from './format';
import { ChevronLeftIcon, ChevronRightIcon, ExternalIcon, MessageIcon, HeartIcon } from './icons';

const PAGE_SIZE = 8;

// Build a compact page list: 1 … 4 5 [6] 7 8 … 20
const pageList = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= total - 2) [total - 1, total - 2, total - 3].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
};

const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null);

export default function DonationsList({ coin, network, price, totalCount }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('recent');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    httpCommon.get('/public/donations', { params: { page, limit: PAGE_SIZE, sort } })
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [page, sort]);

  const changeSort = (next) => {
    if (next === sort) return;
    setSort(next);
    setPage(1);
  };

  const goTo = (p) => {
    if (!data || p < 1 || p > data.pages || p === page) return;
    setPage(p);
    document.getElementById('donations')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const items = data?.items || [];
  const pages = data?.pages || 1;

  return (
    <section className="ol-section" id="donations" aria-labelledby="donations-title">
      <div className="ol-section-head">
        <div>
          <span className="ol-eyebrow"><HeartIcon size={14} /> Community powered</span>
          <h2 id="donations-title" className="ol-section-title">Donations received</h2>
          <p className="ol-section-sub">
            Every claim is funded by people like you. Here are the {totalCount ? totalCount.toLocaleString('en-US') : ''} donations
            that kept ZecFaucet running — memos included.
          </p>
        </div>
        <div className="ol-segment" role="tablist" aria-label="Sort donations">
          <button
            id="donations-sort-recent"
            role="tab"
            aria-selected={sort === 'recent'}
            className={`ol-segment-btn ${sort === 'recent' ? 'is-active' : ''}`}
            onClick={() => changeSort('recent')}
          >
            Most recent
          </button>
          <button
            id="donations-sort-top"
            role="tab"
            aria-selected={sort === 'top'}
            className={`ol-segment-btn ${sort === 'top' ? 'is-active' : ''}`}
            onClick={() => changeSort('top')}
          >
            Largest
          </button>
        </div>
      </div>

      <div className={`ol-card ol-donations ${loading && data ? 'is-loading' : ''}`}>
        {error && (
          <div className="ol-empty">Couldn&apos;t load donations right now. Please try again later.</div>
        )}

        {!error && !data && loading && (
          <ul className="ol-donation-list">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="ol-donation ol-donation-skeleton">
                <div className="ol-skel ol-skel-amount" />
                <div className="ol-skel-body">
                  <div className="ol-skel ol-skel-line" />
                  <div className="ol-skel ol-skel-line short" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {!error && data && items.length === 0 && (
          <div className="ol-empty">No donations recorded yet. Be the first to support the faucet!</div>
        )}

        {!error && items.length > 0 && (
          <ul className="ol-donation-list">
            {items.map((d, i) => {
              const rank = sort === 'top' ? (page - 1) * PAGE_SIZE + i + 1 : null;
              const m = rank ? medal(rank) : null;
              return (
                <li
                  key={`${d.txid}-${i}`}
                  className={`ol-donation ${m ? 'is-top' : ''}`}
                  style={{ animationDelay: `${i * 45}ms` }}
                >
                  <div className="ol-donation-amount">
                    {rank && <span className="ol-rank">{m || `#${rank}`}</span>}
                    <span className="ol-donation-zec">
                      {formatZec(d.value)} <small>{coin}</small>
                    </span>
                    {price ? <span className="ol-donation-usd">≈ {formatUsd(d.value * price)}</span> : null}
                  </div>

                  <div className="ol-donation-body">
                    {d.memo ? (
                      <p className="ol-memo">
                        <MessageIcon size={15} />
                        <span>{d.memo}</span>
                      </p>
                    ) : (
                      <p className="ol-memo is-empty">No memo attached</p>
                    )}
                    <div className="ol-donation-meta">
                      <span title={new Date(d.time).toLocaleString('en-US')}>
                        {formatDate(d.time)} · {formatRelative(d.time)}
                      </span>
                      {d.txid && (
                        <a
                          className="ol-txid"
                          href={explorerUrl(network, d.txid)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={d.txid}
                        >
                          {shortTxid(d.txid)} <ExternalIcon size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!error && data && pages > 1 && (
          <nav className="ol-pagination" aria-label="Donations pagination">
            <button
              id="donations-prev"
              className="ol-page-btn"
              onClick={() => goTo(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeftIcon size={16} />
            </button>
            {pageList(page, pages).map((p) =>
              typeof p === 'string' ? (
                <span key={p} className="ol-page-gap">…</span>
              ) : (
                <button
                  key={p}
                  id={`donations-page-${p}`}
                  className={`ol-page-btn ${p === page ? 'is-active' : ''}`}
                  onClick={() => goTo(p)}
                  aria-current={p === page ? 'page' : undefined}
                >
                  {p}
                </button>
              )
            )}
            <button
              id="donations-next"
              className="ol-page-btn"
              onClick={() => goTo(page + 1)}
              disabled={page >= pages}
              aria-label="Next page"
            >
              <ChevronRightIcon size={16} />
            </button>
          </nav>
        )}
      </div>
    </section>
  );
}
