// ═══════════════════════════════════════════════════════
//  renderer.js — Leaflet map, canvas dot overlay, population density
//  Depends on: data.js (COUNTRIES, ISO_NUM_TO_INFO, COUNTRY_BY_ISO)
// ═══════════════════════════════════════════════════════

let map, geoLayer, dotCanvas, dotCtx;
let currentSnapshot = null;
let showDensity = false;

// Layer tile definitions
const TILE_LAYERS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attr: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attr: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
  },
  terrain: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attr: '&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
  },
};
let activeTileLayer = null;

// Country GeoJSON layer references: iso2 → Leaflet layer
const countryLayers = {};

// Infection stage fill colours
const STAGE_STYLE = {
  unaffected:  { fillColor:'#0f1e38', fillOpacity:0.82, color:'#0a1428', weight:0.6 },
  early:       { fillColor:'#5c2800', fillOpacity:0.88, color:'#0a1428', weight:0.6 },
  widespread:  { fillColor:'#a04000', fillOpacity:0.92, color:'#0a1428', weight:0.6 },
  overwhelmed: { fillColor:'#cc2000', fillOpacity:0.95, color:'#0a1428', weight:0.6 },
  origin:      { fillColor:'#8b0000', fillOpacity:1.0,  color:'#ff3b30', weight:1.8 },
};

function densityStyle(density) {
  let fill;
  if      (!density || density < 10)  fill = '#0a1830';
  else if (density < 50)              fill = '#1a4466';
  else if (density < 100)             fill = '#445500';
  else if (density < 200)             fill = '#886600';
  else if (density < 500)             fill = '#b35000';
  else                                fill = '#8b0000';
  return { fillColor: fill, fillOpacity: 0.82, color: '#0a1428', weight: 0.6 };
}

function infectionStage(snap, iso) {
  if (!snap) return 'unaffected';
  const c = snap.countries[iso];
  if (!c) return 'unaffected';
  const frac = (c.I + c.E) / c.N;
  if (frac > 0.05 || c.D > 50000)  return 'overwhelmed';
  if (frac > 0.01 || c.D > 5000)   return 'widespread';
  if (frac > 0.001 || c.D > 100)   return 'early';
  return 'unaffected';
}

// ── Map initialisation ────────────────────────────────
async function initMap() {
  map = L.map('map-wrap', {
    center: [20, 10],
    zoom: 2,
    minZoom: 2,
    maxZoom: 10,
    zoomControl: true,
    attributionControl: true,
  });

  // Reposition zoom control so it doesn't clash with our UI
  map.zoomControl.setPosition('bottomright');

  // Default tile layer
  setTileLayer('dark');

  // Load TopoJSON and build GeoJSON country layer
  try {
    const world   = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r => r.json());
    const geojson = topojson.feature(world, world.objects.countries);

    geoLayer = L.geoJSON(geojson, {
      style:          featureStyle,
      onEachFeature:  onEachFeature,
    }).addTo(map);

  } catch (e) {
    console.error('Failed to load world map:', e);
  }

  // Create the death-dot canvas overlay
  createDotCanvas();

  // Redraw dots whenever map moves or zooms
  map.on('move zoom moveend zoomend', () => {
    if (currentSnapshot) drawDots(currentSnapshot, currentSnapshot.day);
  });

  // Resize canvas when map container resizes
  map.on('resize', () => {
    syncCanvas();
    if (currentSnapshot) drawDots(currentSnapshot, currentSnapshot.day);
  });
}

// ── Tile layer switching ──────────────────────────────
function setTileLayer(key) {
  if (activeTileLayer) map.removeLayer(activeTileLayer);
  const def = TILE_LAYERS[key];
  activeTileLayer = L.tileLayer(def.url, {
    attribution: def.attr,
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  // Update control button states
  document.querySelectorAll('.mc-btn[data-layer]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layer === key);
  });
}

// ── Feature style ─────────────────────────────────────
function featureStyle(feature) {
  const info = ISO_NUM_TO_INFO[feature.id] || {};
  const iso  = info.iso || '';

  if (showDensity) {
    const country = COUNTRY_BY_ISO[iso];
    return densityStyle(country ? country.density : undefined);
  }

  if (!currentSnapshot || !iso) return STAGE_STYLE.unaffected;

  // Handled by app.js after simulation starts (originIso check lives there)
  const stage = infectionStage(currentSnapshot, iso);
  return STAGE_STYLE[stage];
}

// ── Per-feature event wiring ──────────────────────────
function onEachFeature(feature, layer) {
  const info = ISO_NUM_TO_INFO[feature.id] || {};
  const name = info.name || `Unknown region (${feature.id})`;
  const iso  = info.iso  || '';

  // Store reference for fast style updates
  if (iso) countryLayers[iso] = layer;

  layer.on('mouseover', function(e) {
    showTooltip(e.originalEvent, name, iso);
    this.setStyle({ weight: 1.5, fillOpacity: Math.min((this.options.fillOpacity || 0.8) + 0.1, 1) });
  });
  layer.on('mousemove', function(e) {
    moveTooltip(e.originalEvent);
  });
  layer.on('mouseout', function() {
    hideTooltip();
    geoLayer.resetStyle(this);
    // Reapply correct style
    this.setStyle(featureStyle(feature));
  });
  layer.on('click', function() {
    const country = COUNTRY_BY_ISO[iso];
    if (country) selectOriginCountry(country);
  });
}

// ── Snapshot apply: update all country colours ────────
function applySnapshot(day, originIso) {
  currentSnapshot = window._snapshots ? window._snapshots[day] : null;
  if (!currentSnapshot || !geoLayer) return;

  geoLayer.eachLayer(layer => {
    if (!layer.feature) return;
    const info  = ISO_NUM_TO_INFO[layer.feature.id] || {};
    const iso   = info.iso || '';
    if (!iso) return;

    let style;
    if (showDensity) {
      const c = COUNTRY_BY_ISO[iso];
      style = densityStyle(c ? c.density : undefined);
    } else if (iso === originIso) {
      style = STAGE_STYLE.origin;
    } else {
      const stage = infectionStage(currentSnapshot, iso);
      style = STAGE_STYLE[stage];
    }
    layer.setStyle(style);
  });

  drawDots(currentSnapshot, day);
}

// ── Toggle density overlay ────────────────────────────
function toggleDensity(on) {
  showDensity = on;

  const btn = document.getElementById('density-toggle');
  btn.classList.toggle('active', on);

  document.getElementById('infection-legend').style.display = on ? 'none' : '';
  document.getElementById('density-legend').style.display   = on ? ''     : 'none';
  document.getElementById('legend-title').textContent       = on ? 'POPULATION DENSITY' : 'INFECTION STATUS';

  // Trigger a full redraw
  if (geoLayer) {
    geoLayer.eachLayer(layer => {
      if (layer.feature) layer.setStyle(featureStyle(layer.feature));
    });
  }
  // If simulation is running, reapply snapshot colours on top
  if (currentSnapshot && window._simParams) {
    applySnapshot(currentSnapshot.day, window._simParams.originIso);
  }
}

// ── Canvas dot overlay ────────────────────────────────
const MAX_DOTS = 150;
const DOT_R    = 3;

function createDotCanvas() {
  dotCanvas = document.createElement('canvas');
  dotCanvas.id = 'dot-canvas';
  document.getElementById('map-wrap').appendChild(dotCanvas);
  dotCtx = dotCanvas.getContext('2d');
  syncCanvas();
}

function syncCanvas() {
  const wrap = document.getElementById('map-wrap');
  dotCanvas.width  = wrap.offsetWidth;
  dotCanvas.height = wrap.offsetHeight;
  dotCanvas.style.width  = wrap.offsetWidth  + 'px';
  dotCanvas.style.height = wrap.offsetHeight + 'px';
}

function drawDots(snap, day) {
  if (!dotCtx || !map) return;
  dotCtx.clearRect(0, 0, dotCanvas.width, dotCanvas.height);

  COUNTRIES.forEach(c => {
    const cs = snap.countries[c.iso];
    if (!cs || cs.D < 100) return;

    const count = Math.min(Math.floor(cs.D / 100), MAX_DOTS);
    const rng   = seededRng(c.iso);

    for (let i = 0; i < count; i++) {
      const center = c.centers[i % c.centers.length];
      const jLat   = (rng() - 0.5) * 2.5;
      const jLng   = (rng() - 0.5) * 2.5;
      const birthD = Math.max(0, day - Math.floor(rng() * 20));
      const alpha  = Math.min(1, (day - birthD) / 5) * 0.88;

      const pt = map.latLngToContainerPoint([center[0] + jLat, center[1] + jLng]);

      // Outer glow
      dotCtx.beginPath();
      dotCtx.arc(pt.x, pt.y, DOT_R + 2.5, 0, Math.PI * 2);
      dotCtx.fillStyle = `rgba(255,80,40,${alpha * 0.22})`;
      dotCtx.fill();

      // Core dot
      dotCtx.beginPath();
      dotCtx.arc(pt.x, pt.y, DOT_R, 0, Math.PI * 2);
      dotCtx.fillStyle = `rgba(255,55,35,${alpha})`;
      dotCtx.fill();
    }
  });
}

function seededRng(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h ^= (h >>> 16);
    return (h >>> 0) / 0xffffffff;
  };
}

// ── Tooltip helpers ───────────────────────────────────
function showTooltip(event, name, iso) {
  const tip = document.getElementById('tooltip');
  let html  = `<div class="tt-name">${name}</div>`;

  if (currentSnapshot && iso && currentSnapshot.countries[iso]) {
    const cs = currentSnapshot.countries[iso];
    html += `<div class="tt-row">ACTIVE <span class="tt-val">${fmtNum(Math.round(cs.I + cs.E))}</span></div>`;
    html += `<div class="tt-row">DEATHS <span class="tt-val">${fmtNum(Math.round(cs.D))}</span></div>`;
    const c = COUNTRY_BY_ISO[iso];
    if (c) html += `<div class="tt-row">DENSITY <span class="tt-val">${c.density} /km²</span></div>`;
  } else {
    const c = COUNTRY_BY_ISO[iso];
    if (c) {
      html += `<div class="tt-row">POP <span class="tt-val">${c.pop}M</span></div>`;
      html += `<div class="tt-row">DENSITY <span class="tt-val">${c.density} /km²</span></div>`;
    }
    html += `<div class="tt-row" style="color:var(--text-muted)">CLICK TO SELECT AS ORIGIN</div>`;
  }

  tip.innerHTML = html;
  tip.style.display = 'block';
  moveTooltip(event);
}

function moveTooltip(event) {
  const tip  = document.getElementById('tooltip');
  const wrap = document.getElementById('map-wrap');
  const rect = wrap.getBoundingClientRect();
  let x = event.clientX - rect.left + 14;
  let y = event.clientY - rect.top  - 10;
  // Keep within bounds
  if (x + 160 > wrap.offsetWidth)  x = event.clientX - rect.left - 165;
  if (y + 80  > wrap.offsetHeight) y = event.clientY - rect.top  - 90;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}

function hideTooltip() {
  document.getElementById('tooltip').style.display = 'none';
}

// Formatting helper (used in tooltip; full version in app.js)
function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}
