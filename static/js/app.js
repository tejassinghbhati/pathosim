// ═══════════════════════════════════════════════════════
//  app.js — Boot, UI controllers, playback loop
//  Depends on: data.js, simulation.js, renderer.js, news.js
// ═══════════════════════════════════════════════════════

const SIM_START_DATE = new Date('2026-06-01');

// Shared simulation state — renderer.js also reads these via window globals
window._snapshots  = null;
window._simParams  = null;

let currentDay     = 0;
let playing        = false;
let playInterval   = null;
const reportedMilestones = new Set();

// ── Formatting ────────────────────────────────────────
function fmtNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString();
}

// ── Stats bar update ──────────────────────────────────
function updateStats(snap) {
  document.getElementById('stat-cases').textContent    = fmtNum(snap.totalCases);
  document.getElementById('stat-active').textContent   = fmtNum(snap.totalActive);
  document.getElementById('stat-deaths').textContent   = fmtNum(snap.totalDeaths);
  document.getElementById('stat-countries').textContent = snap.countriesAffected;

  const cfr = snap.totalCases > 0 ? (snap.totalDeaths / snap.totalCases * 100) : 0;
  document.getElementById('stat-cfr').textContent = cfr.toFixed(2) + '%';

  // Effective R: R0 × fraction still susceptible in origin country
  const originSnap = snap.countries[window._simParams?.originIso];
  const susceptFrac = originSnap ? originSnap.S / originSnap.N : 1;
  const re = window._simParams ? (window._simParams.r0 * susceptFrac).toFixed(2) : '—';
  const reEl = document.getElementById('stat-re');
  reEl.textContent = re;
  reEl.style.color = parseFloat(re) > 1 ? 'var(--red)' : 'var(--green)';
}

// ── Day display ───────────────────────────────────────
function updateDayDisplay(day) {
  const date = new Date(SIM_START_DATE);
  date.setDate(date.getDate() + day);
  const longDate  = date.toLocaleDateString('en-US', { month:'long',  day:'numeric', year:'numeric' });
  const shortDate = date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });

  document.getElementById('day-display').innerHTML =
    `<span class="status-dot live"></span>DAY ${String(day).padStart(3,'0')} — ${shortDate}`;
  document.getElementById('timeline-date').textContent = longDate;
  document.getElementById('timeline-day').textContent  = `DAY ${day} OF ${DAYS}`;
  document.getElementById('scrubber').value = day;
}

// ── Apply snapshot (renderer + stats + day display) ───
function applySnapshotAll(day) {
  if (!window._snapshots) return;
  currentDay = day;
  const snap = window._snapshots[day];
  applySnapshot(day, window._simParams.originIso);  // renderer.js
  updateStats(snap);
  updateDayDisplay(day);
}

// ── Playback ──────────────────────────────────────────
function startPlay() {
  if (playing || !window._snapshots) return;
  playing = true;
  document.getElementById('play-btn').textContent = '⏸';
  document.getElementById('play-btn').classList.add('playing');

  const intervalMs = getSpeed();
  let d = currentDay;

  playInterval = setInterval(async () => {
    if (d >= DAYS - 1) { stopPlay(); return; }
    d++;
    applySnapshotAll(d);

    const snap = window._snapshots[d];
    const prev = d > 0 ? window._snapshots[d - 1] : null;

    // Milestone news
    for (const mid of checkMilestones(snap, prev)) {
      if (!reportedMilestones.has(mid)) {
        reportedMilestones.add(mid);
        const item = await generateHeadline(mid, window._simParams.originName, snap, window._simParams.apiKey);
        addNewsItem(d, item, SIM_START_DATE);
      }
    }

    // Vaccine milestones
    const vd = window._simParams.vaccineMonths * 30;
    if (d === vd && !reportedMilestones.has('vaccine')) {
      reportedMilestones.add('vaccine');
      addNewsItem(d, await generateHeadline('vaccine', window._simParams.originName, snap, window._simParams.apiKey), SIM_START_DATE);
    }
    if (d === vd + 14 && !reportedMilestones.has('vaccineRollout')) {
      reportedMilestones.add('vaccineRollout');
      addNewsItem(d, await generateHeadline('vaccineRollout', window._simParams.originName, snap, window._simParams.apiKey), SIM_START_DATE);
    }
  }, intervalMs);
}

function stopPlay() {
  playing = false;
  document.getElementById('play-btn').textContent = '▶';
  document.getElementById('play-btn').classList.remove('playing');
  if (playInterval) { clearInterval(playInterval); playInterval = null; }
}

function getSpeed() {
  const s = document.querySelector('.speed-btn.active')?.dataset.speed || 'normal';
  return s === 'slow' ? 300 : s === 'fast' ? 30 : 100;
}

// ── Origin country selection ──────────────────────────
// Called by renderer.js when a country is clicked on the map
function selectOriginCountry(country) {
  document.getElementById('origin-display').textContent = `ORIGIN SELECTED: ${country.name.toUpperCase()}`;
  document.getElementById('origin-select').value = country.iso;
  document.getElementById('config-overlay').style.display = 'flex';
}

// ── Start simulation ──────────────────────────────────
function startSimulation() {
  const originIso = document.getElementById('origin-select').value;
  const origin    = COUNTRY_BY_ISO[originIso];
  if (!origin) return;

  window._simParams = {
    originIso,
    originName:    origin.name,
    r0:            parseFloat(document.getElementById('r0').value),
    incubDays:     parseInt(document.getElementById('incub').value),
    mortalityRate: parseFloat(document.getElementById('mort').value) / 100,
    vaccineMonths: parseInt(document.getElementById('vacc').value),
    apiKey:        document.getElementById('api-key').value.trim(),
  };

  // Update analytics sidebar
  document.getElementById('ap-r0').textContent    = window._simParams.r0;
  document.getElementById('ap-incub').textContent = window._simParams.incubDays + ' days';
  document.getElementById('ap-mort').textContent  = (window._simParams.mortalityRate * 100).toFixed(1) + '%';
  document.getElementById('ap-vacc').textContent  = window._simParams.vaccineMonths + ' months';

  document.getElementById('config-overlay').style.display = 'none';
  document.getElementById('computing-overlay').style.display = 'flex';

  // Defer computation so the loading overlay renders first
  setTimeout(() => {
    window._snapshots = computeAllSnapshots(window._simParams);

    document.getElementById('computing-overlay').style.display = 'none';
    document.getElementById('idle-hint').style.display  = 'none';
    document.getElementById('reconfigure-btn').style.display = 'block';

    resetNews();
    reportedMilestones.clear();
    currentDay = 0;

    applySnapshotAll(0);
    startPlay();
  }, 80);
}

// ── UI initialisation ─────────────────────────────────
function populateOriginSelect() {
  const sel = document.getElementById('origin-select');
  [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name)).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.iso;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
  sel.value = 'CN';
}

function initSliders() {
  [['r0','r0-val'],['incub','incub-val'],['mort','mort-val'],['vacc','vacc-val']].forEach(([id, vid]) => {
    document.getElementById(id).addEventListener('input', function() {
      document.getElementById(vid).textContent = this.value;
    });
  });
}

function initSpeedButtons() {
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// ── Boot ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  populateOriginSelect();
  initSliders();
  initSpeedButtons();
  await initMap();  // renderer.js

  // Config actions
  document.getElementById('start-btn').addEventListener('click', startSimulation);
  document.getElementById('reconfigure-btn').addEventListener('click', () => {
    stopPlay();
    document.getElementById('config-overlay').style.display = 'flex';
  });
  document.getElementById('origin-select').addEventListener('change', function() {
    const c = COUNTRY_BY_ISO[this.value];
    if (c) document.getElementById('origin-display').textContent = `ORIGIN SELECTED: ${c.name.toUpperCase()}`;
  });

  // Playback
  document.getElementById('play-btn').addEventListener('click', () => {
    if (playing) stopPlay(); else startPlay();
  });

  // Scrubber
  document.getElementById('scrubber').addEventListener('input', function() {
    if (!window._snapshots) return;
    stopPlay();
    applySnapshotAll(parseInt(this.value));
  });

  // Map layer switcher
  document.querySelectorAll('.mc-btn[data-layer]').forEach(btn => {
    btn.addEventListener('click', () => setTileLayer(btn.dataset.layer));  // renderer.js
  });

  // Density toggle
  document.getElementById('density-toggle').addEventListener('click', function() {
    const on = this.dataset.active !== 'true';
    this.dataset.active = on ? 'true' : 'false';
    toggleDensity(on);  // renderer.js
  });
});
