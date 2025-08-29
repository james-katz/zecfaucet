// verify_captcha.js
// Input expected: { id, x, scale, duration, trail }
// trail: array of { x, y, t } samples from rc-slider-captcha (ms timestamps)

const TOLERANCE_PX = 4;
const MIN_DURATION_MS = 600;     // < 0.6s feels botty
const MAX_DURATION_MS = 6000;   // > 6s: suspicious (can adjust)
const MIN_TRAIL_POINTS = 12;     // very short trails are suspicious
const MAX_LINEARITY = 0.985;     // R^2 too close to a line → likely bot
const MIN_SPEED_VAR = 0.08;      // std/mean speed too low → constant speed = bot
const MAX_BACKTRACK_PX = 12;     // allow tiny wiggles but no big backtracks
const MAX_IDLE_GAP_MS = 900;     // very long pauses within trail → odd

function summarizeTrail(trailPairs, durationMs, pxScale = 1) {
  const scale = Number(pxScale) || 1;
  const dur   = Math.max(0, Number(durationMs) || 0);

  // sanitize -> {x,y,t} where t is synthesized from duration
  const raw = Array.isArray(trailPairs) ? trailPairs : [];
  const pts = raw
    .map((p, i) => ({
      x: Number(p?.[0]) / scale,
      y: Number(p?.[1]) / scale,
      __i: i
    }))
    .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

  if (pts.length < 2) return { ok: false, reason: 'no_trail' };

  // Assign synthetic timestamps: evenly spaced over duration (or unit steps if no duration)
  const n  = pts.length;
  const dt = dur > 0 ? dur / Math.max(1, n - 1) : 1;
  for (let i = 0; i < n; i++) pts[i].t = i * dt;

  // Metrics
  let totalDx = 0, totalDy = 0, totalDist = 0;
  const speeds = [];
  let maxBacktrack = 0;
  let maxIdleGap = 0;

  for (let i = 1; i < n; i++) {
    const dx = pts[i].x - pts[i-1].x;
    const dy = pts[i].y - pts[i-1].y;
    const dti = Math.max(1, pts[i].t - pts[i-1].t); // avoid 0
    totalDx += dx;
    totalDy += dy;
    const dist = Math.hypot(dx, dy);
    totalDist += dist;
    const spd = dist / dti; // px per ms if duration given; px per step if not
    if (Number.isFinite(spd)) speeds.push(spd);
    if (dx < 0) maxBacktrack = Math.max(maxBacktrack, Math.abs(dx));
    if (dti > maxIdleGap) maxIdleGap = dti;
  }

  // Speed variance (coefficient of variation)
  let speedVar = 0;
  if (speeds.length > 0) {
    const mean = speeds.reduce((a,b)=>a+b,0) / speeds.length;
    if (mean > 0) {
      const varSum = speeds.reduce((s,v)=> s + (v-mean)*(v-mean), 0) / speeds.length;
      speedVar = Math.sqrt(varSum) / mean;
    }
  }

  // Linearity (R^2) for x over "time" (synthetic)
  const meanT = pts.reduce((a,p)=>a+p.t, 0) / n;
  const meanX = pts.reduce((a,p)=>a+p.x, 0) / n;
  let ssTot = 0, ssRes = 0, covTX = 0, varT = 0;
  for (const p of pts) {
    ssTot += (p.x - meanX) ** 2;
    covTX += (p.t - meanT) * (p.x - meanX);
    varT  += (p.t - meanT) ** 2;
  }
  let r2 = 1;
  if (varT > 0 && ssTot > 0) {
    const slope = covTX / varT;
    const intercept = meanX - slope * meanT;
    for (const p of pts) {
      const pred = slope * p.t + intercept;
      ssRes += (p.x - pred) ** 2;
    }
    r2 = 1 - (ssRes / ssTot);
    if (!Number.isFinite(r2)) r2 = 1;
  }

  // Final clean
  const safe = (v) => Number.isFinite(v) ? v : 0;

  return {
    ok: true,
    duration: dur,            // ms (0 if not provided)
    count: n,
    totalDx: safe(totalDx),
    totalDy: safe(totalDy),
    totalDist: safe(totalDist),
    speedVar: safe(speedVar),
    r2: safe(r2),
    maxBacktrack: safe(maxBacktrack),
    maxIdleGap: safe(maxIdleGap)
  };
}

function isHumanLike(summary) {
  const {
    duration, count, speedVar, r2, maxBacktrack, maxIdleGap
  } = summary;

  if (duration < MIN_DURATION_MS) return { ok: false, reason: 'too_fast' };
  if (duration > MAX_DURATION_MS) return { ok: false, reason: 'too_slow' };
  if (count < MIN_TRAIL_POINTS)  return { ok: false, reason: 'too_few_points' };
  if (r2 > MAX_LINEARITY)        return { ok: false, reason: 'too_linear' };
  if (speedVar < MIN_SPEED_VAR)  return { ok: false, reason: 'speed_too_constant' };
  if (maxBacktrack > MAX_BACKTRACK_PX) return { ok: false, reason: 'too_much_backtrack' };
  if (maxIdleGap > MAX_IDLE_GAP_MS)    return { ok: false, reason: 'idle_gap' };

  return { ok: true };
}

module.exports.verifySlider = (challengeRow, body) => {
  const { x: clientX, scale = 1, duration, trail } = body;
    
  // 1) position check (as you already do)
  const expectedX = challengeRow.x * Number(scale || 1);
  const posOk = Math.abs(Number(clientX) - expectedX) <= TOLERANCE_PX;
  if (!posOk) return { ok: false, reason: 'pos_mismatch' };

  // 2) trail/duration checks
  const summary = summarizeTrail(trail, duration, Number(scale) || 1);
  if (!summary.ok) return { ok: false, reason: summary.reason || 'no_trail' };

  const human = isHumanLike(summary);
  if (!human.ok) {
    return { ok: false, reason: human.reason, meta: summary };
  }

  return { ok: true, meta: summary };
};