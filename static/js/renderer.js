'use strict';

// ═══════════════════════════════════════════════════════
//  renderer.js  —  Leaflet map + canvas epidemic viz
//  Depends on:  data.js, cities.js, simulation.js
//  Exposes to app.js:  onMapClick(), placeOriginMarker(),
//                      setTileLayer(), toggleHeatmap(), toggleDensity()
// ═══════════════════════════════════════════════════════

let map          = null;
let geoLayer     = null;
let dotCanvas    = null;
let dotCtx       = null;
let heatLayer    = null;
let originMarker = null;
let originRing   = null;

let currentSnapshot = null;
let showDensity     = false;
let showHeatmap     = false;
let animFrame       = 0;        // incremented each rAF tick for per-city phase offset

// ── Tile layers ───────────────────────────────────────
const TILE_LAYERS = {
  dark: {
    url:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attr: '© <a href="https://carto.com/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  },
  satellite: {
    url:  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles © Esri — Source: Esri, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN',
  },
  terrain: {
    url:  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attr: '© <a href="https://carto.com/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  },
};
let activeTileLayer = null;

// Country GeoJSON helpers
const countryLayers = {};
// fillOpacity:0 = truly invisible (no hairline artifact at polar latitudes)
// className:'country-layer' + CSS pointer-events:all = stays hoverable despite 0 opacity
const BASE_STYLE    = { fillColor:'#ffffff', fillOpacity:0, color:'transparent', weight:0, interactive:true, className:'country-layer' };
const HOVER_STYLE   = { fillColor:'#ffffff', fillOpacity:0.10, color:'rgba(255,255,255,0.3)', weight:0.8, className:'country-layer' };

// ── Epidemic phase ────────────────────────────────────
function getEpidemicPhase(cd, prevCd) {
  if (!cd || cd.active < 10) return 'unaffected';

  const N          = Math.max(1, cd.N);
  const activeFrac = cd.active / N;
  const prevActive = prevCd ? prevCd.active : 0;
  const growth     = prevActive > 0 ? cd.active / prevActive : 1;

  if (activeFrac > 0.05)                       return 'overwhelmed';
  if (activeFrac > 0.02)                       return 'peak';
  if (growth > 1.05 && activeFrac > 0.001)     return 'growing';
  if (growth > 1.02)                           return 'early';
  if (growth < 0.95 && activeFrac > 0.0005)   return 'declining';
  return 'endemic';
}

function getPhaseColor(phase) {
  switch (phase) {
    case 'early':       return [255, 210, 50 ];  // amber
    case 'growing':     return [255, 130, 40 ];  // orange
    case 'peak':        return [230, 50,  35 ];  // red
    case 'overwhelmed': return [180, 20,  20 ];  // dark red
    case 'declining':   return [180, 100, 60 ];  // rust
    case 'endemic':     return [130, 130, 90 ];  // tan
    default:            return [80,  80,  80 ];
  }
}

// R_eff heuristic — used only for pulse gating
function growsToday(cd, prevCd) {
  if (!cd || !prevCd) return false;
  const incub  = (window._simParams && window._simParams.incubDays) || 5;
  const period = Math.max(4, incub + 5);
  const ratio  = cd.active / Math.max(1, prevCd.active);
  return Math.pow(ratio, period) > 1.15;  // R_eff > 1.15 triggers pulse
}

// ── Map initialisation ────────────────────────────────
async function initMap() {
  if (!document.getElementById('map-wrap')) {
    console.error('No #map-wrap element found'); return;
  }

  map = L.map('map-wrap', {
    center: [20, 10], zoom: 2, minZoom: 2, maxZoom: 14,
    zoomControl: true, attributionControl: true,
  });
  map.zoomControl.setPosition('bottomright');

  setTileLayer('satellite');

  // Heatmap (non-critical)
  try {
    if (typeof L.heatLayer === 'function') buildHeatmap();
    else {
      const b = document.getElementById('heatmap-toggle');
      if (b) { b.disabled = true; b.title = 'Heatmap plugin unavailable'; }
    }
  } catch (e) { console.warn('Heatmap init failed:', e); }

  // Map click → nearest city
  map.on('click', e => {
    try {
      const { lat, lng } = e.latlng;
      const r = findNearestCity(lat, lng);
      if (typeof onMapClick === 'function') onMapClick(r.city, r.idx, r.distKm, lat, lng);
    } catch (err) { console.error('Map click error:', err); }
  });

  // World boundaries (hover/tooltip only — fills transparent)
  try {
    const world   = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r => r.json());
    const geojson = topojson.feature(world, world.objects.countries);
    geoLayer = L.geoJSON(geojson, {
      style:         () => BASE_STYLE,
      onEachFeature: wireCountryEvents,
      smoothFactor:  1.5,
    }).addTo(map);
  } catch (e) {
    console.error('TopoJSON load failed:', e);
    showMapError('Failed to load country boundaries.');
  }

  createDotCanvas();

  map.on('move zoom moveend zoomend', () => { if (currentSnapshot) drawCircles(currentSnapshot); });
  map.on('resize', () => { syncCanvas(); if (currentSnapshot) drawCircles(currentSnapshot); });

  // Continuous animation loop (pulse effect) — runs at rAF rate
  (function loop() {
    animFrame++;
    if (currentSnapshot) drawCircles(currentSnapshot);
    requestAnimationFrame(loop);
  })();
}

// ── Tile switching ────────────────────────────────────
function setTileLayer(key) {
  if (activeTileLayer) try { map.removeLayer(activeTileLayer); } catch (_) {}
  const def = TILE_LAYERS[key] || TILE_LAYERS.satellite;
  activeTileLayer = L.tileLayer(def.url, { attribution: def.attr, subdomains:'abcd', maxZoom:19 }).addTo(map);
  if (heatLayer && showHeatmap) heatLayer.addTo(map);
  document.querySelectorAll('.mlc-btn[data-layer]').forEach(b => b.classList.toggle('active', b.dataset.layer === key));
}

// ── Population heatmap ────────────────────────────────
function buildHeatmap() {
  const data = CITIES.map(c => [c.lat, c.lng, Math.min(1, Math.log10(c.pop * 1e6 + 1) / 8)]);
  if (heatLayer) try { map.removeLayer(heatLayer); } catch (_) {}
  heatLayer = L.heatLayer(data, {
    radius:30, blur:24, maxZoom:6, max:1.0,
    gradient:{ 0.1:'#050d20', 0.35:'#062a55', 0.6:'#0a4a80', 0.8:'#0d6aaa', 0.95:'#00aadd', 1:'#00d4ff' },
  });
  if (showHeatmap) heatLayer.addTo(map);
}

function toggleHeatmap(on) {
  showHeatmap = on;
  if (!heatLayer) return;
  if (on) heatLayer.addTo(map); else try { map.removeLayer(heatLayer); } catch (_) {}
  const b = document.getElementById('heatmap-toggle');
  if (b) b.classList.toggle('active', on);
}

// ── Country hover ─────────────────────────────────────
function wireCountryEvents(feature, layer) {
  const info = ISO_NUM_TO_INFO[Number(feature.id)] || {};
  const name = info.name || 'Unknown territory';
  const iso  = info.iso  || '';
  if (iso) countryLayers[iso] = layer;

  layer.on({
    mouseover: e => {
      // Russia's polygon covers the entire top of the Mercator map above ~74°N.
      // Suppress tooltip there — no city is that far north.
      if (e.latlng && e.latlng.lat > 74) return;
      layer.setStyle(showDensity ? densityStyle(iso) : HOVER_STYLE);
      showTip(e.originalEvent, name, iso);
    },
    mousemove: e => { if (!(e.latlng && e.latlng.lat > 74)) moveTip(e.originalEvent); },
    mouseout:  () => { hideTip(); layer.setStyle(showDensity ? densityStyle(iso) : BASE_STYLE); },
  });
}

// ── Density overlay ───────────────────────────────────
function densityStyle(iso) {
  const pop = CITIES.filter(c => c.iso === iso).reduce((s, c) => s + c.pop, 0);
  const fill = pop>100?'#8b0000':pop>40?'#b35000':pop>15?'#886600':pop>5?'#445500':pop>1?'#1a4466':'#0a1830';
  return { fillColor:fill, fillOpacity:0.55, color:'transparent', weight:0 };
}

function toggleDensity(on) {
  showDensity = on;
  const b   = document.getElementById('density-toggle');
  if (b) b.classList.toggle('active', on);

  const infEl = document.getElementById('infection-legend');
  const denEl = document.getElementById('density-legend');
  const titEl = document.getElementById('legend-title');
  if (infEl) infEl.style.display = on ? 'none' : '';
  if (denEl) denEl.style.display = on ? ''     : 'none';
  if (titEl) titEl.textContent   = on ? 'POPULATION DENSITY' : 'EPIDEMIC PHASE';

  if (geoLayer) geoLayer.eachLayer(l => {
    if (!l.feature) return;
    const iso = (ISO_NUM_TO_INFO[Number(l.feature.id)] || {}).iso || '';
    l.setStyle(on && iso ? densityStyle(iso) : BASE_STYLE);
  });
}

// ── Apply snapshot ────────────────────────────────────
function applySnapshot(day, _) {
  currentSnapshot = (window._snapshots && window._snapshots[day]) || null;
  // circles are drawn by the animation loop; just update the snapshot reference
}

// ── Origin marker ─────────────────────────────────────
function placeOriginMarker(lat, lng) {
  if (originMarker) try { map.removeLayer(originMarker); } catch (_) {}
  if (originRing)   try { map.removeLayer(originRing);   } catch (_) {}

  originMarker = L.circleMarker([lat, lng], {
    radius: 7, weight: 2.5, color: '#ff3b30',
    fillColor: '#ff6050', fillOpacity: 1, interactive: false,
  }).addTo(map);

  // Animated expanding ring (CSS handles the animation)
  originRing = L.circleMarker([lat, lng], {
    radius: 18, weight: 2, color: '#ff3b30',
    fillOpacity: 0, className: 'origin-ring', interactive: false,
  }).addTo(map);
}

// ── Canvas management ─────────────────────────────────
function createDotCanvas() {
  dotCanvas = document.createElement('canvas');
  dotCanvas.id = 'dot-canvas';
  dotCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:450;';
  document.getElementById('map-wrap').appendChild(dotCanvas);
  dotCtx = dotCanvas.getContext('2d');
  syncCanvas();
}

function syncCanvas() {
  const wrap = document.getElementById('map-wrap');
  if (!wrap || !dotCanvas) return;
  const w = wrap.offsetWidth, h = wrap.offsetHeight;
  dotCanvas.width = w; dotCanvas.height = h;
  dotCanvas.style.width = w + 'px'; dotCanvas.style.height = h + 'px';
}

// ── Draw epidemic rings ───────────────────────────────
//
//  Scientific encoding:
//    Ring RADIUS    — log₁₀(active cases) · range 5–22px
//    Ring COLOUR    — epidemic phase (amber→orange→red→dark-red)
//    Ring THICKNESS — CFR relative to cases (thick = high death rate)
//    Expanding PULSE— emitted when R > 1 (growing outbreak wave front)
//    White DOT      — proportional to cumulative deaths (center)
//
//  Ring visualization keeps the satellite map visible through the marker;
//  overlapping rings form a lace-like network pattern rather than solid blobs.
//
function drawCircles(snap) {
  if (!dotCtx || !map || !snap || !snap.cityData) return;

  const W = dotCanvas.width, H = dotCanvas.height;
  dotCtx.clearRect(0, 0, W, H);

  const day      = snap.day;
  const prevSnap = window._snapshots && day > 0 ? window._snapshots[day - 1] : null;

  // Render largest outbreaks first (background), so smaller emerging ones
  // appear on top and remain visible
  const order = [];
  for (let i = 0; i < CITIES.length; i++) {
    const cd = snap.cityData[i];
    if (cd && cd.active >= 10) order.push(i);
  }
  order.sort((a, b) => (snap.cityData[b].active || 0) - (snap.cityData[a].active || 0));

  for (const i of order) {
    const cd     = snap.cityData[i];
    const city   = CITIES[i];
    const prevCd = prevSnap ? prevSnap.cityData[i] : null;

    let pt;
    try { pt = map.latLngToContainerPoint([city.lat, city.lng]); }
    catch (_) { continue; }

    if (pt.x < -35 || pt.x > W + 35 || pt.y < -35 || pt.y > H + 35) continue;

    const phase    = getEpidemicPhase(cd, prevCd);
    if (phase === 'unaffected') continue;
    const [r, g, b] = getPhaseColor(phase);
    const growing  = growsToday(cd, prevCd);

    // Ring radius: logarithmic — 10 cases→5px, 10k→14px, 1M→22px
    const ringR = Math.max(5, Math.min(22, Math.log10(cd.active + 1) * 4.0));

    // Ring line-width encodes CFR: thicker = more deaths per infection
    const cfrFrac = cd.D / Math.max(1, cd.D + cd.active);
    const lineW   = Math.max(1.5, Math.min(5.5, cfrFrac * 50 + 1.5));

    // ── Pulse rings (wave-front indicator) ────────────
    if (growing) {
      const offset = (i * 23) % 80;
      const t      = ((animFrame + offset) % 80) / 80;   // 0→1
      // Triangle fade: bright at t=0.3, fade out by t=1
      const alpha  = Math.max(0, 0.6 - Math.abs(t - 0.3) * 1.2);
      const pulseR = ringR + 5 + t * 15;

      dotCtx.beginPath();
      dotCtx.arc(pt.x, pt.y, pulseR, 0, Math.PI * 2);
      dotCtx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.75).toFixed(3)})`;
      dotCtx.lineWidth   = 1.2;
      dotCtx.stroke();
    }

    // ── Soft glow halo (very subtle — keeps map readable) ──
    const glowR = ringR * 2.0;
    const grd   = dotCtx.createRadialGradient(pt.x, pt.y, ringR * 0.6, pt.x, pt.y, glowR);
    grd.addColorStop(0, `rgba(${r},${g},${b},0.14)`);
    grd.addColorStop(1, `rgba(${r},${g},${b},0.00)`);
    dotCtx.beginPath();
    dotCtx.arc(pt.x, pt.y, glowR, 0, Math.PI * 2);
    dotCtx.fillStyle = grd;
    dotCtx.fill();

    // ── Main ring ─────────────────────────────────────
    dotCtx.beginPath();
    dotCtx.arc(pt.x, pt.y, ringR, 0, Math.PI * 2);
    dotCtx.strokeStyle = `rgba(${r},${g},${b},0.92)`;
    dotCtx.lineWidth   = lineW;
    dotCtx.stroke();

    // ── Death core: white dot at centre ───────────────
    // Size encodes accumulated deaths (log scale); opacity encodes CFR fraction.
    if (cd.D > 50) {
      const dR    = Math.max(1.5, Math.min(ringR * 0.40, Math.log10(cd.D) * 0.85));
      const alpha = Math.min(0.95, 0.35 + cfrFrac * 9);
      dotCtx.beginPath();
      dotCtx.arc(pt.x, pt.y, dR, 0, Math.PI * 2);
      dotCtx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      dotCtx.fill();
    }
  }
}

// ── Tooltip ───────────────────────────────────────────
function showTip(event, name, iso) {
  const tip = document.getElementById('tooltip');
  if (!tip) return;

  let html = `<div class="tt-name">${name}</div>`;

  if (currentSnapshot && iso && currentSnapshot.countries[iso]) {
    const c   = currentSnapshot.countries[iso];
    const cfr = c.N > 0 ? (c.D / Math.max(1, c.D + c.active) * 100) : 0;
    html += `<div class="tt-row">ACTIVE  <span class="tt-val">${_fmt(Math.round(c.active))}</span></div>`;
    html += `<div class="tt-row">DEATHS  <span class="tt-val">${_fmt(Math.round(c.D))}</span></div>`;
    html += `<div class="tt-row">CFR     <span class="tt-val">${cfr.toFixed(2)}%</span></div>`;
  }

  const cities = CITIES.filter(c => c.iso === iso);
  if (cities.length) {
    const tier    = cities[0].tier;
    const tierLbl = (TIER_PARAMS[tier] || {}).label || '—';
    html += `<div class="tt-row">CITIES     <span class="tt-val">${cities.length}</span></div>`;
    html += `<div class="tt-row">HEALTHCARE <span class="tt-val tier-${tier}">${tierLbl}</span></div>`;
  } else if (!currentSnapshot) {
    html += `<div class="tt-row" style="color:var(--cyan);margin-top:4px">CLICK TO SET OUTBREAK ORIGIN</div>`;
  }

  tip.innerHTML = html;
  tip.style.display = 'block';
  moveTip(event);
}

function moveTip(event) {
  const tip  = document.getElementById('tooltip');
  const wrap = document.getElementById('map-wrap');
  if (!tip || !wrap) return;
  const r = wrap.getBoundingClientRect();
  let x = event.clientX - r.left + 16;
  let y = event.clientY - r.top  - 12;
  if (x + 220 > wrap.offsetWidth)  x = event.clientX - r.left - 230;
  if (y + 120 > wrap.offsetHeight) y = event.clientY - r.top  - 130;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}

function hideTip() {
  const tip = document.getElementById('tooltip');
  if (tip) tip.style.display = 'none';
}

// Private number formatter
function _fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

function showMapError(msg) {
  const wrap = document.getElementById('map-wrap');
  if (!wrap) return;
  const div = document.createElement('div');
  div.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);'
    + 'background:rgba(8,14,30,0.95);border:1px solid #ff3b30;border-radius:6px;'
    + 'padding:14px 20px;font-family:monospace;font-size:11px;color:#ff3b30;z-index:600;';
  div.textContent = '⚠ ' + msg;
  wrap.appendChild(div);
}
