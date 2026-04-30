// BondBot dashboard — vanilla renderer. Polls the bot API every 5s,
// repaints KPIs, OKR gates, equity chart, tables.

const REFRESH_MS = 5000;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const fmtMoney = (n, signed = true) => {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const fmt = abs >= 1000 ? abs.toLocaleString('en-US', { maximumFractionDigits: 0 })
                          : abs.toFixed(2);
  const sign = signed ? (n > 0 ? '+' : n < 0 ? '−' : '') : (n < 0 ? '−' : '');
  return `${sign}$${fmt}`;
};
const fmtPct = (n) => (n == null || isNaN(n)) ? '—' : `${(n * 100).toFixed(1)}%`;
const fmtPctSigned = (n) =>
  (n == null || isNaN(n)) ? '—' : `${n > 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const relTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));


// ─────────────────────────────────── OKR / KPI render ───────────────────────────────────

const VALIDATION = { resolved: 50, winRate: 0.94, avgReturn: 0.045 };

function paintKpis(stats) {
  const all = stats.all_time || {};
  $('#kpi-pnl').textContent = fmtMoney(all.total_pnl);
  $('#kpi-pnl').className = 'kpi-value ' + (all.total_pnl > 0 ? 'pos' : all.total_pnl < 0 ? 'neg' : '');
  $('#kpi-pnl-sub').textContent =
    `${all.resolved || 0} closed | 24h ${fmtMoney((stats.last_24h||{}).total_pnl)}`;

  $('#kpi-winrate').textContent = fmtPct(all.win_rate);
  $('#kpi-winrate').className = 'kpi-value ' +
    (all.win_rate >= VALIDATION.winRate ? 'pos' : all.win_rate > 0 ? 'warn' : '');

  $('#kpi-avgret').textContent = fmtPctSigned(all.avg_return);
  $('#kpi-avgret').className = 'kpi-value ' +
    (all.avg_return >= VALIDATION.avgReturn ? 'pos' :
     all.avg_return < 0 ? 'neg' :
     all.avg_return > 0 ? 'warn' : '');

  $('#kpi-resolved').textContent = (all.resolved ?? 0).toString();
  $('#kpi-resolved').className = 'kpi-value ' +
    (all.resolved >= VALIDATION.resolved ? 'pos' : '');

  $('#kpi-open').textContent = stats.open_positions ?? '—';
  $('#kpi-open-sub').textContent = `bankroll ${fmtMoney(stats.bankroll, false)}`;

  $('#kpi-mode').textContent = stats.mode || '—';
  $('#kpi-mode-sub').textContent = stats.mode === 'PAPER' ? 'no real capital at risk' : 'LIVE — real money';
}

function paintOkr(stats) {
  const all = stats.all_time || {};
  const gates = [
    { sel: '[data-gate="resolved"]',  pct: Math.min(1, (all.resolved||0) / VALIDATION.resolved),
      pass: all.resolved >= VALIDATION.resolved,
      label: `${all.resolved || 0} / ${VALIDATION.resolved}` },
    { sel: '[data-gate="winrate"]',   pct: Math.min(1, (all.win_rate||0) / VALIDATION.winRate),
      pass: (all.win_rate || 0) >= VALIDATION.winRate,
      label: fmtPct(all.win_rate) },
    { sel: '[data-gate="avgret"]',    pct: Math.min(1, Math.max(0, (all.avg_return||0) / VALIDATION.avgReturn)),
      pass: (all.avg_return || 0) >= VALIDATION.avgReturn,
      label: fmtPctSigned(all.avg_return) },
  ];
  for (const g of gates) {
    const row = $(g.sel);
    row.classList.toggle('pass', g.pass);
    row.classList.toggle('fail', !g.pass && all.resolved > 0);
    row.querySelector('.okr-fill').style.width = `${g.pct * 100}%`;
    row.querySelector('.okr-status').textContent = g.label;
  }
}

// ─────────────────────────────────── Equity curve ───────────────────────────────────

function drawEquityCurve(curve) {
  const canvas = $('#equity-canvas');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 1200;
  const cssH = 220;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  if (!curve || curve.length === 0) {
    ctx.fillStyle = '#4d5564';
    ctx.font = '13px ' + getComputedStyle(document.body).fontFamily;
    ctx.textAlign = 'center';
    ctx.fillText('no closed positions yet — equity curve appears after first resolution',
                 cssW / 2, cssH / 2);
    return;
  }

  const padL = 60, padR = 16, padT = 16, padB = 28;
  const w = cssW - padL - padR;
  const h = cssH - padT - padB;

  const xs = curve.map((p) => new Date(p.t).getTime());
  const ys = curve.map((p) => p.cum_pnl);
  const xMin = xs[0], xMax = xs[xs.length - 1] || xMin + 1;
  const yPad = (Math.max(...ys) - Math.min(...ys)) * 0.15 || 1;
  const yMin = Math.min(...ys, 0) - yPad;
  const yMax = Math.max(...ys, 0) + yPad;
  const X = (i) => padL + ((xs[i] - xMin) / (xMax - xMin || 1)) * w;
  const Y = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * h;

  // y-axis grid + labels
  ctx.strokeStyle = '#161d27';
  ctx.fillStyle = '#768094';
  ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const v = yMin + (yMax - yMin) * (i / 4);
    const y = Y(v);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(cssW - padR, y); ctx.stroke();
    ctx.fillText(fmtMoney(v), padL - 8, y + 4);
  }
  // zero line
  if (yMin < 0 && yMax > 0) {
    ctx.strokeStyle = '#1f2733';
    ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(cssW - padR, Y(0)); ctx.stroke();
  }

  // gradient fill below line
  const g = ctx.createLinearGradient(0, padT, 0, padT + h);
  g.addColorStop(0, 'rgba(96, 165, 250, 0.35)');
  g.addColorStop(1, 'rgba(96, 165, 250, 0.00)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(X(0), Y(0));
  for (let i = 0; i < curve.length; i++) ctx.lineTo(X(i), Y(ys[i]));
  ctx.lineTo(X(curve.length - 1), Y(0));
  ctx.closePath(); ctx.fill();

  // line
  ctx.strokeStyle = ys[ys.length - 1] >= 0 ? '#4ade80' : '#f87171';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < curve.length; i++) {
    if (i === 0) ctx.moveTo(X(i), Y(ys[i]));
    else ctx.lineTo(X(i), Y(ys[i]));
  }
  ctx.stroke();

  // last point dot
  const lx = X(curve.length - 1), ly = Y(ys[ys.length - 1]);
  ctx.fillStyle = ys[ys.length - 1] >= 0 ? '#4ade80' : '#f87171';
  ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fill();
}

// ─────────────────────────────────── Tables ───────────────────────────────────

function paintOpenPositions(positions) {
  const tb = $('#open-table tbody');
  if (!positions.length) {
    tb.innerHTML = '<tr><td colspan="5" class="muted">no open positions</td></tr>';
    $('#open-count').textContent = '0';
    return;
  }
  $('#open-count').textContent = `${positions.length} positions`;
  tb.innerHTML = positions.map((p) => `
    <tr>
      <td><span class="tag ${p.side === 'YES' ? 'yes' : 'no'}">${p.side}</span></td>
      <td class="q-cell" title="${escapeHtml(p.market_question)}">${escapeHtml(p.market_question)}</td>
      <td class="num">$${(+p.entry_price).toFixed(3)}</td>
      <td class="num">$${(+p.size_usd).toFixed(2)}</td>
      <td class="num" title="${escapeHtml(p.end_date)}">${fmtTime(p.end_date)}</td>
    </tr>
  `).join('');
}

function paintClosedPositions(positions) {
  const tb = $('#closed-table tbody');
  if (!positions.length) {
    tb.innerHTML = '<tr><td colspan="4" class="muted">none yet — waiting for first resolution</td></tr>';
    $('#closed-count').textContent = '0';
    return;
  }
  $('#closed-count').textContent = `${positions.length} resolved`;
  tb.innerHTML = positions.slice(0, 30).map((p) => {
    const tagClass = p.status === 'CLOSED-WIN' ? 'win' :
                      p.status === 'CLOSED-STOPLOSS' ? 'stop' : 'loss';
    const tagLabel = p.status.replace('CLOSED-', '');
    const pnlClass = p.pnl_usd > 0 ? 'pos' : p.pnl_usd < 0 ? 'neg' : '';
    return `
      <tr>
        <td><span class="tag ${tagClass}">${tagLabel}</span></td>
        <td class="q-cell" title="${escapeHtml(p.market_question)}">${escapeHtml(p.market_question)}</td>
        <td class="num">$${(+p.entry_price).toFixed(3)} → $${(+(p.exit_price ?? 0)).toFixed(3)}</td>
        <td class="num ${pnlClass}">${fmtMoney(p.pnl_usd)}</td>
      </tr>
    `;
  }).join('');
}

function paintScans(scans) {
  const tb = $('#scans-table tbody');
  if (!scans.length) { tb.innerHTML = '<tr><td colspan="5" class="muted">—</td></tr>'; return; }
  tb.innerHTML = scans.slice(0, 20).map((s) => `
    <tr>
      <td>${fmtTime(s.scanned_at)} <span class="muted small">${relTime(s.scanned_at)}</span></td>
      <td class="num">${s.markets_seen}</td>
      <td class="num">${s.candidates_found}</td>
      <td class="num">${s.positions_opened}</td>
      <td class="num">${fmtMoney(s.bankroll_used, false)}</td>
    </tr>
  `).join('');
}

function paintSkips(skips) {
  const tb = $('#skips-table tbody');
  if (!skips.length) { tb.innerHTML = '<tr><td colspan="3" class="muted">—</td></tr>'; return; }
  tb.innerHTML = skips.slice(0, 12).map((s) => `
    <tr>
      <td>${escapeHtml(s.skip_reason)}</td>
      <td class="num">${s.n}</td>
      <td class="num">${s.avg_price ? '$' + (+s.avg_price).toFixed(3) : '—'}</td>
    </tr>
  `).join('');
}

function paintConfig(cfg) {
  if (!cfg || !cfg.risk) return;
  const r = cfg.risk;
  const items = [
    ['MODE', cfg.mode],
    ['BANKROLL', '$' + cfg.bankroll.toLocaleString()],
    ['SCAN', cfg.scan_interval_seconds + 's'],
    ['PRICE BAND', `${r.price_min} – ${r.price_max}`],
    ['HOURS TO RES', `${r.hours_min}h – ${r.hours_max}h`],
    ['MIN VOLUME', '$' + r.volume_min.toLocaleString()],
    ['POS CAP', '$' + r.position_cap_usd.toLocaleString()],
    ['MAX OPEN', r.max_concurrent.toString()],
    ['STOP LOSS', '$' + r.stop_loss_price.toFixed(2)],
    ['KELLY', (r.kelly_fraction * 100).toFixed(0) + '%'],
  ];
  $('#config-grid').innerHTML = items.map(([k, v]) => `
    <div class="config-item">
      <div class="config-item-label">${k}</div>
      <div class="config-item-value">${escapeHtml(v)}</div>
    </div>
  `).join('');
}

// ─────────────────────────────────── Refresh loop ───────────────────────────────────

let refreshing = false;

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    const settings = await window.bondbot.getSettings();
    if (!settings.apiUrl || !settings.apiKey) {
      setHealth(false, 'no settings — open ⚙ to configure');
      $('#settings-dialog').showModal();
      return;
    }

    const [stats, openPos, closedPos, scans, skips, equity, config] = await Promise.all([
      window.bondbot.api('/stats'),
      window.bondbot.api('/positions?status=OPEN&limit=50'),
      window.bondbot.api('/positions?status=ALL&limit=100'),
      window.bondbot.api('/scans?limit=20'),
      window.bondbot.api('/skips'),
      window.bondbot.api('/equity'),
      window.bondbot.api('/config'),
    ]);

    if (!stats.ok) {
      setHealth(false, `${stats.status} ${stats.body?.error || ''}`);
      return;
    }
    setHealth(true, `connected · ${relTime(stats.body.ts)}`);

    paintKpis(stats.body);
    paintOkr(stats.body);
    paintOpenPositions(openPos.body.positions || []);
    const closedOnly = (closedPos.body.positions || []).filter((p) => p.status !== 'OPEN');
    paintClosedPositions(closedOnly);
    paintScans(scans.body.scans || []);
    paintSkips(skips.body.skips_24h || []);
    drawEquityCurve(equity.body.equity_curve || []);
    paintConfig(config.body);
  } catch (err) {
    setHealth(false, err.message);
  } finally {
    refreshing = false;
  }
}

function setHealth(ok, msg) {
  const dot = $('#health-dot');
  dot.classList.toggle('ok', ok);
  dot.classList.toggle('fail', !ok);
  $('#health-label').textContent = msg;
}

// ─────────────────────────────────── Settings dialog ───────────────────────────────────

async function openSettings() {
  const s = await window.bondbot.getSettings();
  $('#api-url').value = s.apiUrl || '';
  $('#api-key').value = s.apiKey || '';
  $('#settings-status').textContent = '';
  $('#settings-dialog').showModal();
}

$('#btn-settings').addEventListener('click', openSettings);
$('#btn-refresh').addEventListener('click', () => refresh());
$('#settings-cancel').addEventListener('click', (e) => {
  e.preventDefault();
  $('#settings-dialog').close();
});

$('#settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const newSettings = {
    apiUrl: $('#api-url').value.trim(),
    apiKey: $('#api-key').value.trim(),
  };
  $('#settings-status').textContent = 'testing connection…';
  await window.bondbot.saveSettings(newSettings);
  const probe = await window.bondbot.api('/health');
  if (probe.ok) {
    $('#settings-dialog').close();
    refresh();
  } else {
    $('#settings-status').textContent = `failed: ${probe.status} ${probe.body?.error || ''}`;
  }
});

// ─────────────────────────────────── Live stream + toasts ───────────────────────────────────

const toastStack = $('#toast-stack');
let isLive = false;

function toast({ title, body, kind = 'info', pnl, ttl = 5000 }) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  let pnlHtml = '';
  if (pnl != null) {
    const cls = pnl > 0 ? 'pos' : pnl < 0 ? 'neg' : '';
    pnlHtml = `<div class="toast-pnl ${cls}">${fmtMoney(pnl)}</div>`;
  }
  el.innerHTML = `
    <div class="toast-title">${escapeHtml(title)}</div>
    <div class="toast-body">${body || ''}</div>
    ${pnlHtml}
  `;
  toastStack.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 250);
  }, ttl);
}

function setLiveStatus(ok, msg) {
  isLive = !!ok;
  const dot = $('#health-dot');
  dot.classList.toggle('live', isLive);
  dot.classList.toggle('ok', !isLive && ok);
  if (msg) $('#health-label').textContent = msg;
}

window.bondbot.onStreamStatus(({ ok, error }) => {
  if (ok) setLiveStatus(true, 'live · streaming');
  else setHealth(false, `stream: ${error || 'reconnecting…'}`);
});

window.bondbot.onStreamEvent(({ kind, data }) => {
  const d = data.data || {};
  if (kind === 'position_opened') {
    toast({
      title: `📥 OPENED · ${d.side}`,
      body: (d.question || '').slice(0, 90) + ` · entry $${(+d.entry_price).toFixed(3)}`,
      kind: 'info',
    });
    refresh();
  } else if (kind === 'position_closed') {
    const tag = d.status === 'CLOSED-WIN' ? 'win' :
                d.status === 'CLOSED-STOPLOSS' ? 'stop' : 'loss';
    const verb = d.status === 'CLOSED-WIN' ? '✅ WIN' :
                  d.status === 'CLOSED-STOPLOSS' ? '🛑 STOP' : '❌ LOSS';
    toast({
      title: `${verb} · ${d.side}`,
      body: (d.question || '').slice(0, 90),
      kind: tag,
      pnl: d.pnl,
      ttl: 8000,
    });
    refresh();
  } else if (kind === 'scan_complete') {
    if (d.opened > 0) refresh();   // only refresh when something material happened
  }
  // heartbeats are silent — they just keep the connection alive
});

// ─────────────────────────────────── Boot ───────────────────────────────────

setInterval(refresh, REFRESH_MS);
refresh();

// Repaint chart on resize so it stays sharp
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => refresh(), 250);
});
