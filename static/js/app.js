'use strict';

// ═══════════════════════════════════════════════════════
//  app.js — Simulator controller
// ═══════════════════════════════════════════════════════

const SIM_START_DATE = new Date('2026-06-01');
const DAYS_TOTAL     = typeof DAYS !== 'undefined' ? DAYS : 730;

window._snapshots  = null;
window._simParams  = null;
window._mlFeatureImportance = null;

let currentDay           = 0;
let playing              = false;
let playTickTimer        = null;
let selectedCityIdx      = null;
const reportedMilestones = new Set();

// ── Utilities ─────────────────────────────────────────
const el   = id => document.getElementById(id);
const setText = (id, v) => { const e = el(id); if (e) e.textContent = v; };
const setCoStep = msg => setText('co-step', msg);

function fmtNum(n) {
  n = Math.max(0, Math.round(n));
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

function simDate(day, fmt = 'long') {
  const d = new Date(SIM_START_DATE);
  d.setDate(d.getDate() + day);
  return d.toLocaleDateString('en-US', fmt === 'long'
    ? { month:'long', day:'numeric', year:'numeric' }
    : { month:'short', day:'numeric', year:'numeric' });
}

// ── Delta metrics (header chips) ─────────────────────
function updateDeltaMetrics(snap, prevSnap) {
  const fmt = fmtNum;
  const delta = (cur, prev, id, invert = false) => {
    const d   = Math.round(cur - prev);
    const e   = el(id);
    if (!e) return;
    if (d === 0) { e.textContent = ''; return; }
    const up  = d > 0;
    e.textContent = (up ? '↑' : '↓') + fmt(Math.abs(d));
    e.className   = 'dc-delta ' + ((up !== invert) ? 'up' : 'down');
  };

  setText('stat-deaths',    fmtNum(snap.totalDeaths));
  setText('stat-active',    fmtNum(snap.totalActive));
  setText('stat-countries', snap.countriesAffected);

  const cfr = snap.totalCases > 0 ? (snap.totalDeaths / snap.totalCases * 100).toFixed(2) + '%' : '—';

  // Effective R (origin city)
  const p = window._simParams;
  if (p && snap.cityData && snap.cityData[p.originCityIdx]) {
    const cd = snap.cityData[p.originCityIdx];
    const N  = cd.N > 0 ? cd.N : 1;
    const susceptFrac = Math.max(0, Math.min(1, (N - cd.D - cd.active) / N));
    const tier = (typeof TIER_PARAMS !== 'undefined' && TIER_PARAMS[CITIES[p.originCityIdx].tier]) || { betaMult: 1 };
    const re   = (p.r0 * susceptFrac * tier.betaMult).toFixed(2);
    const reEl = el('stat-re');
    if (reEl) {
      reEl.textContent = re;
      reEl.style.color = parseFloat(re) > 1 ? 'var(--red)' : 'var(--green)';
    }
  }

  // Deltas
  if (prevSnap) {
    delta(snap.totalDeaths,       prevSnap.totalDeaths,       'stat-deaths-d');
    delta(snap.totalActive,       prevSnap.totalActive,       'stat-active-d',  true);
    delta(snap.countriesAffected, prevSnap.countriesAffected, 'stat-nations-d');
  }

  // CFR in timeline footer
  setText('tl-cfr', cfr !== '—' ? `CFR ${cfr}` : '');

  // Epidemic phase on timeline
  const re = p && el('stat-re') ? parseFloat(el('stat-re').textContent) : 0;
  let phase = 'Monitoring';
  if (snap.totalActive < 100)           phase = 'Seeding Phase';
  else if (re > 1.5)                    phase = 'Exponential Growth';
  else if (re > 1.0)                    phase = 'Active Spread  R > 1';
  else if (re > 0.6)                    phase = 'Plateau  R ≈ 1';
  else if (snap.totalActive > 1000)     phase = 'Declining  R < 1';
  else                                  phase = 'Subsiding';
  setText('tl-phase', phase);
}

// ── Day / timeline ────────────────────────────────────
function updateDayDisplay(day) {
  const lb = el('lb-text');
  if (lb) lb.textContent = `DAY ${String(day).padStart(3,'0')} — ${simDate(day, 'short')}`;

  const dot = el('live-badge')?.querySelector('.lb-dot');
  if (dot) dot.classList.add('live');

  setText('tl-date', simDate(day));
  setText('tl-day',  `Day ${day} / ${DAYS_TOTAL}`);
  const sc = el('scrubber');
  if (sc) sc.value = day;
}

// ── Live hotspot list (right panel) ──────────────────
function updateHotspots(snap) {
  const list = el('hotspot-list');
  if (!list || !snap || !snap.cityData) return;

  const top = CITIES.map((c, i) => {
    const cd = snap.cityData[i];
    return { name: c.name, active: (cd && cd.active) || 0, idx: i };
  })
  .filter(c => c.active >= 100)
  .sort((a, b) => b.active - a.active)
  .slice(0, 8);

  if (!top.length) {
    list.innerHTML = '<div style="font-family:var(--mono);font-size:9px;color:var(--text-dim);padding:8px 0">No significant outbreaks yet.</div>';
    return;
  }

  const prevSnap = window._snapshots && snap.day > 0 ? window._snapshots[snap.day - 1] : null;

  list.innerHTML = top.map((c, rank) => {
    const cd     = snap.cityData[c.idx];
    const prevCd = prevSnap ? prevSnap.cityData[c.idx] : null;
    const phase  = typeof getEpidemicPhase === 'function' ? getEpidemicPhase(cd, prevCd) : 'growing';
    return `<div class="hotspot-item">
      <span class="hs-rank">${rank + 1}</span>
      <span class="hs-city">${c.name}</span>
      <span class="hs-phase ${phase}">${phase}</span>
      <span class="hs-val">${fmtNum(c.active)}</span>
    </div>`;
  }).join('');
}

// ── Feature importance bars (right panel) ────────────
function renderFIBars(fi) {
  if (!fi) return;
  const names  = fi.features;
  const colors = ['#1a72e8', '#0eb8d0', '#e8920a', '#9b5de5'];

  ['beta', 'cfr'].forEach(key => {
    const container = el(`fi-${key}-bars`);
    if (!container) return;
    const vals   = fi[`${key}_importance`];
    const maxVal = Math.max(...vals);
    container.innerHTML = names.map((name, i) => `
      <div class="fi-bar-row">
        <div class="fi-bar-label">${name}</div>
        <div class="fi-bar-track">
          <div class="fi-bar-fill" style="width:${(vals[i]/maxVal*100).toFixed(1)}%;background:${colors[i]}"></div>
        </div>
        <div class="fi-bar-val">${(vals[i]*100).toFixed(1)}%</div>
      </div>`).join('');
  });
}

// ── Milestone dots on timeline ────────────────────────
function renderMilestoneDots() {
  const container = el('tl-milestones');
  if (!container || !window._snapshots) return;
  const ts = window._snapshots;

  const events = [
    { day: ts.findIndex(s => s.countriesAffected >= 5),   cls: '' },
    { day: ts.findIndex(s => s.countriesAffected >= 30),  cls: 'critical-ms' },
    { day: ts.findIndex(s => s.totalDeaths >= 1e3),       cls: '' },
    { day: ts.findIndex(s => s.totalDeaths >= 1e6),       cls: 'critical-ms' },
    { day: ts.findIndex(s => s.totalDeaths >= 1e7),       cls: 'critical-ms' },
    { day: window._simParams ? window._simParams.vaccineMonths * 30 : -1, cls: '' },
  ].filter(e => e.day > 0 && e.day < DAYS_TOTAL);

  container.innerHTML = events.map(e => {
    const pct = (e.day / (DAYS_TOTAL - 1) * 100).toFixed(2);
    return `<div class="tl-milestone-dot reached ${e.cls}" style="left:${pct}%" title="Day ${e.day}: ${simDate(e.day,'short')}"></div>`;
  }).join('');
}

// ── Apply snapshot ────────────────────────────────────
function applySnapshotAll(day) {
  if (!window._snapshots) return;
  currentDay      = day;
  const snap      = window._snapshots[day];
  const prevSnap  = day > 0 ? window._snapshots[day - 1] : null;
  if (!snap) return;

  applySnapshot(day, window._simParams.originIso);  // renderer.js
  updateDeltaMetrics(snap, prevSnap);
  updateDayDisplay(day);
  updateHotspots(snap);
}

// ── Playback ──────────────────────────────────────────
function startPlay() {
  if (playing || !window._snapshots) return;
  playing = true;
  const btn = el('play-btn');
  if (btn) { btn.textContent = '⏸'; btn.classList.add('playing'); }
  scheduleTick(currentDay);
}

function scheduleTick(d) {
  if (!playing) return;
  playTickTimer = setTimeout(async () => {
    if (!playing) return;
    if (d >= DAYS_TOTAL - 1) { stopPlay(); return; }
    const next = d + 1;
    applySnapshotAll(next);
    fireMilestonesAsync(next).catch(console.warn);
    scheduleTick(next);
  }, getSpeed());
}

async function fireMilestonesAsync(d) {
  if (!window._snapshots || !window._simParams) return;
  const snap = window._snapshots[d];
  const prev = window._snapshots[d - 1] || null;
  if (!snap) return;

  for (const mid of checkMilestones(snap, prev)) {
    if (reportedMilestones.has(mid)) continue;
    reportedMilestones.add(mid);
    try {
      const item = await generateHeadline(mid, window._simParams.originName, snap, window._simParams.apiKey);
      addNewsItem(d, item, SIM_START_DATE);
    } catch (e) { console.warn('Headline:', e); }
  }

  const vd = window._simParams.vaccineMonths * 30;
  for (const [day, key] of [[vd,'vaccine'],[vd+14,'vaccineRollout']]) {
    if (d === day && !reportedMilestones.has(key)) {
      reportedMilestones.add(key);
      try { addNewsItem(d, await generateHeadline(key, window._simParams.originName, snap, window._simParams.apiKey), SIM_START_DATE); }
      catch (e) {}
    }
  }
}

function stopPlay() {
  playing = false;
  clearTimeout(playTickTimer); playTickTimer = null;
  const btn = el('play-btn');
  if (btn) { btn.textContent = '▶'; btn.classList.remove('playing'); }
}

function getSpeed() {
  const s = document.querySelector('.speed-btn.active')?.dataset.speed || 'normal';
  return s === 'slow' ? 300 : s === 'fast' ? 22 : 85;
}

// ── City selection (from renderer.js) ────────────────
function onMapClick(city, idx, distKm) {
  selectedCityIdx = idx;
  const tier = (typeof TIER_PARAMS !== 'undefined' && TIER_PARAMS[city.tier]) || { label: '—' };

  el('origin-card').className  = 'origin-card-filled';
  el('origin-card').innerHTML  = `
    <div class="ocf-city">${city.name}</div>
    <div class="ocf-country">${city.iso} &nbsp;·&nbsp; <span class="tier-badge tier-${city.tier}">${tier.label}</span></div>
    <div class="ocf-meta">
      <div class="ocf-stat">
        <span class="ocf-stat-val">${city.pop}M</span>
        <span class="ocf-stat-lbl">Population</span>
      </div>
      <div class="ocf-stat">
        <span class="ocf-stat-val" style="color:var(--cyan)">${city.hub.toFixed(2)}</span>
        <span class="ocf-stat-lbl">Hub score</span>
      </div>
    </div>
    ${distKm > 80 ? `<div class="ocf-change">Snapped ${distKm}km from click</div>` : ''}`;

  const runBtn = el('run-btn');
  if (runBtn) { runBtn.disabled = false; runBtn.textContent = `▶ Run from ${city.name}`; }

  if (typeof placeOriginMarker === 'function') placeOriginMarker(city.lat, city.lng);
  if (typeof map !== 'undefined' && map) map.flyTo([city.lat, city.lng], Math.max(map.getZoom(), 4), { duration: 0.9 });

  const sb = el('sidebar');
  if (sb && sb.classList.contains('collapsed')) {
    sb.classList.remove('collapsed');
    const tab = el('sidebar-open-tab');
    if (tab) tab.style.display = 'none';
  }
}

// ── ML params fetch ───────────────────────────────────
async function fetchMLParams() {
  const payload = (typeof CITIES !== 'undefined' ? CITIES : []).map(c => ({ name:c.name, iso:c.iso, pop:c.pop, hub:c.hub }));
  try {
    const res = await fetch('/api/ml-params', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cities: payload }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    window._mlFeatureImportance = data.feature_importance || null;
    return data.city_params || null;
  } catch (e) {
    console.warn('ML params unavailable:', e.message);
    return null;
  }
}

// ── Analytics data save ───────────────────────────────
function saveAnalyticsData() {
  if (!window._snapshots || !window._simParams) return;
  const p    = window._simParams;
  const last = window._snapshots[window._snapshots.length - 1];
  const ml   = p.cityMLParams;

  const timeSeries = window._snapshots.map(s => ({
    d: s.day, c: Math.round(s.totalCases), a: Math.round(s.totalActive),
    x: Math.round(s.totalDeaths), n: s.countriesAffected,
  }));

  const cityStats = (typeof CITIES !== 'undefined' ? CITIES : []).map((city, i) => {
    const cd    = last.cityData[i] || { D:0, active:0, N:0 };
    const total = cd.D + cd.active;

    // Peak active and total cases across timeseries
    let peakActive = 0, totalCases = 0;
    for (const snap of window._snapshots) {
      if (snap.cityData && snap.cityData[i]) {
        const cdSnap = snap.cityData[i];
        peakActive = Math.max(peakActive, cdSnap.active || 0);
        // Approximate total cases as deaths + currently infected/exposed
        // (a lower bound; doesn't include recovered but gives a sense of scale)
        totalCases = Math.max(totalCases, cdSnap.D + cdSnap.active);
      }
    }

    return {
      name: city.name, iso: city.iso, tier: city.tier, pop: city.pop,
      deaths: Math.round(cd.D), finalActive: Math.round(cd.active),
      cases: Math.round(totalCases), peakActive: Math.round(peakActive),
      cfr: total > 0 ? (cd.D / total * 100) : 0,
      betaMult: ml ? (ml[i] || {}).beta_mult : null,
      cfrMult:  ml ? (ml[i] || {}).cfr_mult  : null,
      beds:     ml ? (ml[i] || {}).beds      : null,
      density:  ml ? (ml[i] || {}).density   : null,
      haq:      ml ? (ml[i] || {}).haq       : null,
    };
  }).sort((a, b) => b.deaths - a.deaths);

  try {
    sessionStorage.setItem('pathosim_analytics', JSON.stringify({
      params: { originName:p.originName, originIso:p.originIso, r0:p.r0, incubDays:p.incubDays, mortalityRate:p.mortalityRate, vaccineMonths:p.vaccineMonths, mlEnabled: !!ml },
      timeSeries, cityStats,
      featureImportance: window._mlFeatureImportance || null,
    }));
  } catch (e) { console.warn('Analytics save failed:', e); }
}

// ── Run simulation ────────────────────────────────────
function runSimulation() {
  if (selectedCityIdx === null) return;
  const city = CITIES[selectedCityIdx];
  if (!city) return;

  window._simParams = {
    originCityIdx:  selectedCityIdx,
    originIso:      city.iso,
    originName:     city.name,
    r0:             parseFloat(el('r0').value)    || 2.5,
    incubDays:      parseInt(el('incub').value)   || 5,
    mortalityRate: (parseFloat(el('mort').value)  || 1.0) / 100,
    vaccineMonths:  parseInt(el('vacc').value)    || 18,
    apiKey:        (el('api-key').value || '').trim(),
  };

  const overlay = el('computing-overlay');
  overlay.style.display = 'flex';
  setCoStep('Querying ML model for city parameters…');

  fetchMLParams().then(mlParams => {
    window._simParams.cityMLParams = mlParams;

    // Update ML status in sidebar + right panel
    const mlBadge = el('ml-status-badge');
    const rpStatus = el('ml-rp-status');
    const ok = !!mlParams;
    if (mlBadge) { mlBadge.textContent = ok ? '● ML-derived' : '● Tier fallback'; mlBadge.style.color = ok ? 'var(--green)' : 'var(--amber)'; }
    if (rpStatus){ rpStatus.textContent = ok ? 'Active' : 'Fallback (no sklearn)'; rpStatus.style.color = ok ? 'var(--green)' : 'var(--amber)'; }

    if (ok && window._mlFeatureImportance) renderFIBars(window._mlFeatureImportance);

    setCoStep('Computing 730-day SEIR snapshot array…');
    requestAnimationFrame(() => setTimeout(() => {
      try {
        window._snapshots = computeAllSnapshots(window._simParams);
      } catch (e) {
        overlay.style.display = 'none';
        alert('Simulation error: ' + e.message);
        return;
      }

      overlay.style.display = 'none';
      el('map-idle-hint').style.display = 'none';
      el('stat-chips').classList.remove('hidden');
      el('play-btn').disabled  = false;
      el('scrubber').disabled  = false;

      const analyticsBtn = el('btn-analytics');
      if (analyticsBtn) analyticsBtn.classList.remove('hidden');

      // Milestone dots on timeline
      renderMilestoneDots();

      // Reconfigure button
      const runBtn = el('run-btn');
      if (runBtn) {
        runBtn.textContent = '↺ Reconfigure';
        runBtn.onclick = resetSimulation;
      }

      resetNews();
      reportedMilestones.clear();
      currentDay = 0;
      saveAnalyticsData();
      applySnapshotAll(0);
      startPlay();
    }, 20));
  });
}

function resetSimulation() {
  stopPlay();
  selectedCityIdx = null;

  const runBtn = el('run-btn');
  if (runBtn) { runBtn.disabled = true; runBtn.textContent = 'Select an origin city first'; runBtn.onclick = runSimulation; }

  el('origin-card').className = 'origin-empty';
  el('origin-card').innerHTML = '<div class="origin-hint-icon">⊕</div><div class="origin-hint-text">Click anywhere on the map to select the outbreak origin</div>';
  el('map-idle-hint').style.display = '';
  el('stat-chips').classList.add('hidden');
  el('play-btn').disabled = true;
  el('scrubber').disabled = true;

  window._snapshots = null;
  if (typeof originMarker !== 'undefined' && originMarker) try { map.removeLayer(originMarker); } catch(_){}
  if (typeof originRing   !== 'undefined' && originRing)   try { map.removeLayer(originRing);   } catch(_){}
  if (typeof dotCtx !== 'undefined' && dotCtx) dotCtx.clearRect(0, 0, dotCanvas.width, dotCanvas.height);

  const dot = el('live-badge')?.querySelector('.lb-dot');
  if (dot) dot.classList.remove('live');
  setText('lb-text',  'AWAITING CONFIGURATION');
  setText('tl-date',  '——');
  setText('tl-day',   'Day — / 730');
  setText('tl-phase', '——');

  resetNews();
  reportedMilestones.clear();

  const milDots = el('tl-milestones');
  if (milDots) milDots.innerHTML = '';

  if (typeof geoLayer !== 'undefined' && geoLayer) {
    geoLayer.eachLayer(l => { if (l.feature) l.setStyle({ fillColor:'#fff', fillOpacity:0, color:'transparent', weight:0 }); });
  }
}

// ── UI wiring ─────────────────────────────────────────
function initSliders() {
  [['r0','r0-val'],['incub','incub-val'],['mort','mort-val'],['vacc','vacc-val']].forEach(([id,vid]) => {
    const s = el(id); if (s) s.addEventListener('input', function(){ setText(vid, this.value); });
  });
}

function initSpeedButtons() {
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (playing) { clearTimeout(playTickTimer); scheduleTick(currentDay); }
    });
  });
}

function initSidebar() {
  const sb     = el('sidebar');
  const toggle = el('sidebar-toggle');
  const tab    = el('sidebar-open-tab');

  if (toggle) toggle.addEventListener('click', () => {
    sb.classList.add('collapsed');
    if (tab) tab.style.display = 'block';
  });
  if (tab) tab.addEventListener('click', () => {
    sb.classList.remove('collapsed');
    tab.style.display = 'none';
  });
}

function initRightPanel() {
  const panel   = el('right-panel');
  const toggler = el('btn-toggle-right');

  // Tab switching
  document.querySelectorAll('.rp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.rp-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.rp-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const pane = el('pane-' + tab.dataset.pane);
      if (pane) pane.classList.add('active');
    });
  });

  if (toggler) toggler.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    toggler.classList.toggle('active', !panel.classList.contains('collapsed'));
  });
}

// ── Boot ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initSliders();
  initSpeedButtons();
  initSidebar();
  initRightPanel();

  // Create sidebar open tab
  const sb  = el('sidebar');
  const tab = document.createElement('button');
  tab.id    = 'sidebar-open-tab';
  tab.textContent = 'CONFIG';
  tab.style.display = 'none';
  if (sb) sb.insertAdjacentElement('afterend', tab);
  tab.addEventListener('click', () => {
    sb.classList.remove('collapsed');
    tab.style.display = 'none';
  });

  await initMap();   // renderer.js

  el('run-btn').onclick = runSimulation;

  el('play-btn').addEventListener('click', () => {
    if (playing) stopPlay(); else startPlay();
  });

  el('scrubber').addEventListener('input', function() {
    if (!window._snapshots) return;
    stopPlay();
    applySnapshotAll(parseInt(this.value, 10));
  });

  document.querySelectorAll('.mlc-btn[data-layer]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof setTileLayer === 'function') setTileLayer(btn.dataset.layer);
    });
  });
  el('density-toggle').addEventListener('click', () => { if (typeof toggleDensity==='function') toggleDensity(!(typeof showDensity!=='undefined'&&showDensity)); });
  el('heatmap-toggle').addEventListener('click', () => { if (typeof toggleHeatmap==='function') toggleHeatmap(!(typeof showHeatmap!=='undefined'&&showHeatmap)); });
});
