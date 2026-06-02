'use strict';

// ═══════════════════════════════════════════════════════
//  analytics.js  —  Reads sessionStorage → renders all charts
// ═══════════════════════════════════════════════════════

const TIER_LABELS = { 1:'Advanced', 2:'Moderate', 3:'Limited', 4:'Critical' };
const SIM_START   = new Date('2026-06-01');

// Chart.js global defaults — scientific instrument theme
Chart.defaults.color           = '#3e5a7a';
Chart.defaults.borderColor     = '#182e50';
Chart.defaults.font.family     = "'JetBrains Mono', 'Courier New', monospace";
Chart.defaults.font.size       = 10;
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.padding  = 16;
Chart.defaults.plugins.legend.labels.color    = '#9ab0c8';

// ── Utilities ─────────────────────────────────────────
function fmt(n) {
  n = Math.round(n || 0);
  if (n >= 1e9) return (n/1e9).toFixed(2)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(2)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return n.toLocaleString();
}

function simDate(day, style = 'short') {
  const d = new Date(SIM_START);
  d.setDate(d.getDate() + day);
  return d.toLocaleDateString('en-US',
    style === 'long'
      ? { month:'long',  day:'numeric', year:'numeric' }
      : { month:'short', day:'numeric', year:'numeric' });
}

function movAvg(arr, w) {
  return arr.map((_, i) => {
    const sl = arr.slice(Math.max(0, i-w+1), i+1).filter(v => v != null && !isNaN(v));
    return sl.length ? sl.reduce((a,b) => a+b, 0) / sl.length : null;
  });
}

// ── Load data ─────────────────────────────────────────
function loadData() {
  try {
    const raw = sessionStorage.getItem('pathosim_analytics');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { console.error('Parse error:', e); return null; }
}

// ── Shared axis style ─────────────────────────────────
const AXIS = {
  x: { ticks:{ maxTicksLimit:8, autoSkip:true, color:'#1e3050' }, grid:{ color:'#0e1f3a' } },
  y: { ticks:{ color:'#1e3050' }, grid:{ color:'#0e1f3a' }, beginAtZero:true },
  yLog: { type:'logarithmic', ticks:{ color:'#1e3050', callback: v => fmt(v) }, grid:{ color:'#0e1f3a' } },
};

// ── Hero section ──────────────────────────────────────
function renderHero(data) {
  const ts     = data.timeSeries;
  const last   = ts[ts.length - 1];
  const params = data.params;

  const peakA    = Math.max(...ts.map(d => d.a));
  const peakDay  = ts.findIndex(d => d.a === peakA);
  const finalCFR = last.c > 0 ? (last.x / last.c * 100) : 0;

  const heroNums = document.getElementById('hero-numbers');
  heroNums.innerHTML = [
    { val: fmt(last.x),      cls:'red',    label:'Total Deaths',    sub:`CFR ${finalCFR.toFixed(2)}%` },
    { val: fmt(last.c),      cls:'amber',  label:'Total Cases',     sub:`Day 1–730` },
    { val: fmt(peakA),       cls:'cyan',   label:'Peak Active',     sub:`Day ${peakDay} · ${simDate(peakDay)}` },
    { val: last.n,           cls:'blue',   label:'Nations Affected',sub:'at simulation end' },
    { val: params.originName,cls:'',       label:'Origin City',     sub:params.originIso },
    { val: params.r0,        cls:'purple', label:'R₀ Configured',   sub:'basic reproduction number' },
  ].map(n => `
    <div class="hero-num">
      <div class="hn-val ${n.cls}">${n.val}</div>
      <div class="hn-label">${n.label}</div>
      ${n.sub ? `<div class="hn-sub">${n.sub}</div>` : ''}
    </div>`).join('');

  // Meta strip
  const vaccDay  = params.vaccineMonths * 30;
  const d1m      = ts.findIndex(d => d.x >= 1e6);
  const peakRDay = (() => {
    const incub  = (params.incubDays || 5) + 7;
    const raw    = ts.map((d,i) => i===0||ts[i-1].a<=0 ? null : Math.min(8, Math.pow(d.a/Math.max(1,ts[i-1].a), incub)));
    const sm     = movAvg(raw, 7);
    const belowOne = sm.findIndex(v => v !== null && v < 1);
    return belowOne > 0 ? belowOne : null;
  })();

  const meta = document.getElementById('hero-meta');
  meta.innerHTML = [
    { dot:'#0eb8d0', label:'Epidemic peak',  val:`Day ${peakDay} · ${simDate(peakDay, 'long')}` },
    { dot:'#1cad5a', label:'Vaccine ready',  val:vaccDay < 730 ? `Day ${vaccDay} · ${simDate(vaccDay, 'long')}` : 'Beyond 730-day window' },
    { dot:'#9b5de5', label:'R drops <1',     val:peakRDay ? `Day ${peakRDay} · ${simDate(peakRDay, 'long')}` : 'Did not decline within window' },
    { dot:'#d42e1e', label:'1 million dead', val:d1m >= 0 ? `Day ${d1m} · ${simDate(d1m, 'long')}` : 'Not reached' },
    { dot:'#e8920a', label:'Model',          val:params.mlEnabled ? 'ML-enhanced (GradientBoosting)' : 'Tier-based fallback' },
  ].map(m => `
    <div class="hm-item">
      <div class="hm-dot" style="background:${m.dot}"></div>
      <span>${m.label}:</span>
      <span class="hm-val">${m.val}</span>
    </div>`).join('');
}

// ── Header params ─────────────────────────────────────
function renderHeaderParams(params) {
  const el = document.getElementById('ah-params');
  if (!el) return;
  el.innerHTML = [
    ['ORIGIN',   params.originName],
    ['R₀',       params.r0],
    ['INCUB',    params.incubDays+'d'],
    ['BASE CFR', (params.mortalityRate * 100).toFixed(1)+'%'],
    ['VACCINE',  params.vaccineMonths+' mo'],
    ['MODEL',    params.mlEnabled ? 'ML' : 'Tier'],
  ].map(([l,v]) => `<span class="ah-param-item"><span class="ah-param-label">${l}</span><span class="ah-param-val">${v}</span></span>`).join('');
}

// ── Chart 1: Epidemic Curve ───────────────────────────
function renderEpidemicCurve(ts, params) {
  const ctx    = document.getElementById('chart-epidemic').getContext('2d');
  const vaccDay = params.vaccineMonths * 30;
  const peakA   = Math.max(...ts.map(d => d.a));
  const peakDay = ts.findIndex(d => d.a === peakA);
  const labels  = ts.map(d => d.d % 30 === 0 ? simDate(d.d) : '');

  // Vertical line annotations using Chart.js annotation plugin workaround (manual draw)
  const annotPlugin = {
    id: 'epidemicAnnotations',
    afterDatasetsDraw(chart) {
      const { ctx: c, scales } = chart;
      const drawLine = (day, color, label) => {
        if (day < 0 || day >= ts.length) return;
        const x = scales.x.getPixelForValue(day);
        c.save();
        c.beginPath();
        c.moveTo(x, scales.y.top);
        c.lineTo(x, scales.y.bottom);
        c.strokeStyle = color;
        c.lineWidth   = 1.2;
        c.setLineDash([4, 3]);
        c.stroke();
        c.fillStyle = color;
        c.font      = "9px 'JetBrains Mono', monospace";
        c.fillText(label, x + 4, scales.y.top + 12);
        c.restore();
      };
      drawLine(peakDay, '#0eb8d0',  '▲ PEAK');
      drawLine(vaccDay, '#1cad5a',  '💉 VACCINE');
    }
  };

  new Chart(ctx, {
    type: 'line',
    plugins: [annotPlugin],
    data: {
      labels,
      datasets: [
        {
          label: 'Active Infections',
          data: ts.map(d => d.a || 1),
          borderColor: '#0eb8d0', backgroundColor: 'rgba(14,184,208,0.07)',
          borderWidth: 2, pointRadius: 0, fill: true, tension: 0.3,
        },
        {
          label: 'Cumulative Cases',
          data: ts.map(d => d.c || 1),
          borderColor: '#e8920a', backgroundColor: 'transparent',
          borderWidth: 1.5, borderDash: [4,3], pointRadius: 0, tension: 0.3,
        },
        {
          label: 'Deaths',
          data: ts.map(d => d.x || 1),
          borderColor: '#d42e1e', backgroundColor: 'rgba(212,46,30,0.07)',
          borderWidth: 2, pointRadius: 0, fill: true, tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode:'index', intersect:false },
      plugins: {
        legend: { display:true, position:'top' },
        tooltip: {
          callbacks: {
            title: items => `Day ${ts[items[0].dataIndex].d} — ${simDate(ts[items[0].dataIndex].d, 'long')}`,
            label: item  => `  ${item.dataset.label}: ${fmt(item.raw)}`,
          },
        },
      },
      scales: {
        x: AXIS.x,
        y: { ...AXIS.yLog },
      },
    },
  });
}

// ── Chart 2: R-effective ──────────────────────────────
function renderReff(ts, incubDays) {
  const ctx    = document.getElementById('chart-re').getContext('2d');
  const period = (incubDays || 5) + 7;
  const raw    = ts.map((d,i) => {
    if (i === 0 || ts[i-1].a <= 0) return null;
    return Math.min(8, Math.pow(Math.max(0.01, d.a / Math.max(1, ts[i-1].a)), period));
  });
  const smooth = movAvg(raw, 7);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ts.map(d => d.d % 30 === 0 ? simDate(d.d) : ''),
      datasets: [
        {
          label: 'Reff (7-day avg)',
          data: smooth, borderColor:'#9b5de5', backgroundColor:'rgba(155,93,229,0.08)',
          borderWidth:2, pointRadius:0, fill:true, tension:0.4, spanGaps:true,
        },
        {
          label: 'R = 1 (threshold)',
          data: ts.map(() => 1), borderColor:'#e8920a', borderDash:[5,4],
          borderWidth:1, pointRadius:0, fill:false,
        },
      ],
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: {
        legend: { display:true, position:'top' },
        tooltip: {
          filter: i => i.datasetIndex === 0,
          callbacks: {
            title: items => `Day ${ts[items[0].dataIndex].d}`,
            label: item  => `  Reff: ${(item.raw||0).toFixed(2)}`,
          },
        },
      },
      scales: {
        x: AXIS.x,
        y: { min:0, max:5, ticks:{ color:'#1e3050', callback:v=>v.toFixed(1) }, grid:{ color:'#0e1f3a' } },
      },
    },
  });
}

// ── Chart 3: Geographic spread ────────────────────────
function renderSpread(ts) {
  const ctx = document.getElementById('chart-spread').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ts.map(d => d.d % 30 === 0 ? simDate(d.d) : ''),
      datasets: [{
        label: 'Countries with active cases',
        data: ts.map(d => d.n),
        borderColor:'#1a72e8', backgroundColor:'rgba(26,114,232,0.10)',
        borderWidth:2, pointRadius:0, fill:true, tension:0.3,
      }],
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: {
        legend: { display:false },
        tooltip: { callbacks: { title:i=>`Day ${ts[i[0].dataIndex].d}`, label:i=>`  Countries: ${i.raw}` } },
      },
      scales: { x:AXIS.x, y:{ ...AXIS.y } },
    },
  });
}

// ── Chart 4: Daily deaths ─────────────────────────────
function renderDailyDeaths(ts) {
  const ctx   = document.getElementById('chart-deaths').getContext('2d');
  const daily = ts.map((d,i) => i===0 ? 0 : Math.max(0, d.x - ts[i-1].x));
  const avg7  = movAvg(daily, 7);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ts.map(d => d.d % 30 === 0 ? simDate(d.d) : ''),
      datasets: [
        { label:'Daily deaths', data:daily, backgroundColor:'rgba(212,46,30,0.22)', borderColor:'transparent', borderWidth:0, barPercentage:1.0, categoryPercentage:1.0 },
        { label:'7-day avg',    data:avg7,  type:'line', borderColor:'#d42e1e', borderWidth:2, pointRadius:0, fill:false, tension:0.3 },
      ],
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: {
        legend: { display:true, position:'top' },
        tooltip: { callbacks:{ title:i=>`Day ${ts[i[0].dataIndex].d}`, label:i=>`  ${i.dataset.label}: ${fmt(i.raw)}` } },
      },
      scales: { x:AXIS.x, y:{ ...AXIS.y, ticks:{ color:'#1e3050', callback:v=>fmt(v) }, grid:{ color:'#0e1f3a' } } },
    },
  });
}

// ── Chart 5: Healthcare tier impact ──────────────────
function renderTierChart(cityStats) {
  const ctx = document.getElementById('chart-tiers').getContext('2d');
  const T   = [1,2,3,4];

  const d100k = T.map(t => {
    const cs = cityStats.filter(c => c.tier===t);
    if (!cs.length) return 0;
    return (cs.reduce((s,c)=>s+c.deaths,0) / cs.reduce((s,c)=>s+c.pop*1e6,0)) * 1e5;
  });
  const avgCFR = T.map(t => {
    const cs = cityStats.filter(c => c.tier===t && (c.deaths+c.finalActive)>0);
    return cs.length ? cs.reduce((s,c)=>s+c.cfr,0)/cs.length : 0;
  });

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: T.map(t => TIER_LABELS[t]),
      datasets: [
        {
          label:'Deaths per 100k', data:d100k.map(v=>Math.round(v)), yAxisID:'y',
          backgroundColor:['rgba(28,173,90,0.4)','rgba(26,114,232,0.4)','rgba(232,146,10,0.4)','rgba(212,46,30,0.4)'],
          borderColor:    ['#1cad5a','#1a72e8','#e8920a','#d42e1e'], borderWidth:1.5,
        },
        {
          label:'Avg CFR %', data:avgCFR.map(v=>+v.toFixed(2)), type:'line', yAxisID:'y2',
          borderColor:'#9b5de5', borderWidth:2, pointRadius:5, pointBackgroundColor:'#9b5de5', fill:false,
        },
      ],
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:true, position:'top' } },
      scales: {
        x:  { ticks:{ color:'#3e5a7a' }, grid:{ color:'#0e1f3a' } },
        y:  { position:'left',  ticks:{ color:'#1e3050', callback:v=>fmt(v) },  grid:{ color:'#0e1f3a' }, title:{ display:true, text:'Deaths per 100k', color:'#1e3050', font:{ size:9 } } },
        y2: { position:'right', ticks:{ color:'#1e3050', callback:v=>v.toFixed(1)+'%' }, grid:{ display:false }, title:{ display:true, text:'Avg CFR %', color:'#1e3050', font:{ size:9 } } },
      },
    },
  });
}

// ── ML: Feature importance bars ───────────────────────
function renderFeatureImportance(fi) {
  if (!fi) return;
  const colors = ['#1a72e8', '#0eb8d0', '#e8920a', '#9b5de5'];
  ['beta','cfr'].forEach(key => {
    const ctx  = document.getElementById(`chart-fi-${key}`).getContext('2d');
    const vals = fi[`${key}_importance`];
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: fi.features,
        datasets: [{
          data: vals,
          backgroundColor: colors.map(c => c+'88'),
          borderColor:     colors,
          borderWidth: 1.5,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ display:false } },
        scales: {
          x: { ticks:{ color:'#1e3050', callback:v=>(v*100).toFixed(0)+'%' }, grid:{ color:'#0e1f3a' }, beginAtZero:true },
          y: { ticks:{ color:'#3e5a7a' }, grid:{ color:'#0e1f3a' } },
        },
      },
    });
  });
}

// ── ML: Scatter plots ─────────────────────────────────
function renderMLScatter(cityStats, xKey, xLabel, canvasId) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const cols = { 1:'#1cad5a', 2:'#1a72e8', 3:'#e8920a', 4:'#d42e1e' };
  const valid = cityStats.filter(c => c[xKey] != null && c.pop > 0);
  const pts   = valid.map(c => ({ x:c[xKey], y:c.pop>0?(c.deaths/(c.pop*1e4)):0, label:c.name, tier:c.tier }));

  new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [1,2,3,4].map(t => ({
        label: `Tier ${t} — ${TIER_LABELS[t]}`,
        data:  pts.filter(p=>p.tier===t),
        backgroundColor: (cols[t]||'#888')+'99',
        borderColor:     cols[t]||'#888',
        borderWidth:1, pointRadius:4, pointHoverRadius:6,
      })),
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: {
        legend:{ display:true, position:'top' },
        tooltip:{ callbacks:{ label:i=>`${i.raw.label}: ${i.raw.y.toFixed(1)}/100k` } },
      },
      scales: {
        x:{ title:{ display:true, text:xLabel, color:'#3e5a7a', font:{size:9} }, ticks:{color:'#1e3050'}, grid:{color:'#0e1f3a'} },
        y:{ title:{ display:true, text:'Deaths per 100k', color:'#3e5a7a', font:{size:9} }, ticks:{color:'#1e3050'}, grid:{color:'#0e1f3a'}, beginAtZero:true },
      },
    },
  });
}

// ── Cities table with dynamic sorting ──────────────────
function renderCitiesTable(cityStats, mlEnabled) {
  const tbody = document.getElementById('cities-tbody');
  let sortBy = 'deaths';

  function computeMetrics(stats) {
    return stats.map(c => ({
      ...c,
      deathsper100k: c.pop > 0 ? (c.deaths / (c.pop * 1e6) * 1e5) : 0,
    }));
  }

  function updateSort(key) {
    sortBy = key;
    const metrics = computeMetrics(cityStats);
    let sorted = [...metrics];

    switch (key) {
      case 'deathsper100k':
        sorted.sort((a, b) => b.deathsper100k - a.deathsper100k);
        break;
      case 'cases':
        sorted.sort((a, b) => (b.cases || 0) - (a.cases || 0));
        break;
      case 'peakactive':
        sorted.sort((a, b) => (b.peakActive || 0) - (a.peakActive || 0));
        break;
      case 'cfr':
        sorted.sort((a, b) => b.cfr - a.cfr);
        break;
      case 'deaths':
      default:
        sorted.sort((a, b) => b.deaths - a.deaths);
    }

    tbody.innerHTML = sorted.slice(0, 30).map((c, i) => `
      <tr>
        <td class="td-rank">${i + 1}</td>
        <td class="td-city">${c.name}</td>
        <td class="td-iso">${c.iso}</td>
        <td><span class="tier-pill t${c.tier}">${TIER_LABELS[c.tier]}</span></td>
        <td class="td-num amber">${c.betaMult != null ? c.betaMult.toFixed(3) : '—'}</td>
        <td class="td-num purple">${c.cfrMult != null ? c.cfrMult.toFixed(3) : '—'}</td>
        <td class="td-num red">${fmt(c.deaths)}</td>
        <td class="td-num amber">${c.deathsper100k.toFixed(0)}</td>
        <td class="td-num cyan">${fmt(c.cases || 0)}</td>
        <td class="td-num">${fmt(c.peakActive || 0)}</td>
        <td class="td-num">${c.cfr.toFixed(2)}%</td>
        <td class="td-num">${c.pop}M</td>
      </tr>`).join('');
  }

  // Button listeners
  document.querySelectorAll('.tc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tc-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateSort(btn.dataset.sort);
    });
  });

  updateSort('deaths');
}

// ── Milestone timeline ────────────────────────────────
function renderMilestones(ts, params) {
  const items = [];
  const add = (day, sev, tag, html, sub) => items.push({ day, sev, tag, html, sub: sub||'' });

  const vaccDay = params.vaccineMonths * 30;

  const ev = (threshold, fn) => ts.find(fn);

  const s5   = ts.find(d=>d.n>=5);
  const s15  = ts.find(d=>d.n>=15);
  const s30  = ts.find(d=>d.n>=30);
  const d1k  = ts.find(d=>d.x>=1e3);
  const d10k = ts.find(d=>d.x>=1e4);
  const d100k= ts.find(d=>d.x>=1e5);
  const d1m  = ts.find(d=>d.x>=1e6);
  const d10m = ts.find(d=>d.x>=1e7);
  const first= ts.find(d=>d.a>=500);
  const peak = ts.reduce((mx,d)=>d.a>mx.a?d:mx,ts[0]);
  const incub= (params.incubDays||5)+7;
  const raw  = ts.map((d,i)=>i===0||ts[i-1].a<=0?null:Math.min(8,Math.pow(d.a/Math.max(1,ts[i-1].a),incub)));
  const sm   = movAvg(raw,7);
  const belowOne = sm.findIndex(v=>v!==null&&v<1);

  if (first)   add(first.d,  'normal',  'SEEDING',    `Outbreak seeding — <strong>${fmt(first.a)} active infections</strong> across modelled cities`, `${first.n} countries · ${fmt(first.x)} deaths`);
  if (s5)      add(s5.d,    'warning', 'SPREAD',     `International spread — virus detected in <strong>${s5.n} countries</strong>`, `${fmt(s5.x)} cumulative deaths · active: ${fmt(s5.a)}`);
  if (s15)     add(s15.d,   'warning', 'SPREAD',     `Regional epidemic — active transmission in <strong>${s15.n} nations</strong>`, `WHO Emergency Response Committee activated`);
  if (s30)     add(s30.d,   'critical','PANDEMIC',   `<strong>Global pandemic declared</strong> — ${s30.n} nations with active transmission`, `${fmt(s30.x)} deaths · ${fmt(s30.a)} active cases`);
  if (d1k)     add(d1k.d,   'warning', 'DEATHS 1K',  `Global death toll reaches <strong>1,000</strong> — national emergencies declared`, `${d1k.n} countries affected`);
  if (d10k)    add(d10k.d,  'warning', 'DEATHS 10K', `<strong>10,000 deaths</strong> — emergency procurement and border controls escalated`, `${d10k.n} countries · ${fmt(d10k.a)} active`);
  if (d100k)   add(d100k.d, 'critical','DEATHS 100K',`<strong>100,000 deaths</strong> — WHO Public Health Emergency of International Concern`, `${d100k.n} countries in active transmission`);
  if (d1m)     add(d1m.d,   'critical','DEATHS 1M',  `<strong>1 million dead</strong> — world leaders convene emergency summit`, `Reff at this point: ${sm[d1m.d]!=null?sm[d1m.d].toFixed(2):'—'}`);
  if (d10m)    add(d10m.d,  'critical','DEATHS 10M', `<strong>10 million deaths</strong> — health systems in collapse across 40+ nations`, `${fmt(d10m.a)} still active`);
  add(peak.d, 'warning','PEAK', `<strong>Epidemic peak</strong> — ${fmt(peak.a)} simultaneous active infections globally`, `${peak.n} countries · ${fmt(peak.x)} cumulative deaths`);
  if (belowOne>0) add(belowOne,'positive','R < 1',`<strong>Effective reproduction number drops below 1</strong> — epidemic now declining`, `${fmt(ts[belowOne].a)} active · ${fmt(ts[belowOne].x)} deaths`);
  if (vaccDay<730) add(vaccDay,'positive','VACCINE',`<strong>Vaccine available</strong> — ${params.vaccineMonths}-month development timeline met`, `Mass immunisation begins · 1.8%/day coverage rate`);

  const d6  = ts.find(d=>d.d>=180);
  const d12 = ts.find(d=>d.d>=365);
  const last= ts[ts.length-1];
  if (d6)  add(d6.d, 'normal','6 MONTHS', `Six-month mark — <strong>${fmt(d6.x)} cumulative deaths</strong>`, `${d6.n} countries · active: ${fmt(d6.a)}`);
  if (d12) add(d12.d,'normal','1 YEAR',   `One year — <strong>${fmt(d12.x)} cumulative deaths</strong>`, `${d12.n} countries · active: ${fmt(d12.a)}`);
  add(last.d,'normal','END', `<strong>Projection complete — Day 730</strong>`, `${fmt(last.x)} total deaths · ${fmt(last.c)} total cases · ${last.n} nations affected`);

  items.sort((a,b)=>a.day-b.day);

  document.getElementById('milestone-timeline').innerHTML = items.map(it => `
    <div class="milestone-item ms-col-${it.sev}">
      <div class="ms-day-col">
        <div class="ms-day-num">Day ${it.day}</div>
        <div>${simDate(it.day)}</div>
      </div>
      <div class="ms-icon-col">
        <div class="ms-dot ms-dot-${it.sev}"></div>
        <div class="ms-line"></div>
      </div>
      <div class="ms-content">
        <div class="ms-text">
          <span class="ms-tag ms-tag-${it.sev}">${it.tag}</span>
          ${it.html}
        </div>
        ${it.sub ? `<div class="ms-sub">${it.sub}</div>` : ''}
      </div>
    </div>`).join('');
}

// ── Main ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const data = loadData();

  if (!data || !data.timeSeries?.length) {
    document.getElementById('no-data').style.display = 'flex';
    return;
  }

  document.getElementById('analytics-hero').style.display = '';
  document.getElementById('analytics-main').style.display = '';

  const { timeSeries: ts, params, cityStats } = data;
  window._analyticsData = data;

  renderHeaderParams(params);
  renderHero(data);
  renderEpidemicCurve(ts, params);
  renderReff(ts, params.incubDays);
  renderSpread(ts);
  renderDailyDeaths(ts);
  renderTierChart(cityStats);

  // ML section
  const mlSection = document.getElementById('ml-section');
  if (params.mlEnabled && data.featureImportance && mlSection) {
    mlSection.style.display = '';
    renderFeatureImportance(data.featureImportance);
    if (cityStats[0]?.beds != null) {
      renderMLScatter(cityStats, 'beds',    'Hospital beds per 1,000',          'chart-beds-deaths');
      renderMLScatter(cityStats, 'density', 'Population density (persons/km²)', 'chart-density-deaths');
    }
  }

  renderCitiesTable(cityStats, params.mlEnabled);
  renderMilestones(ts, params);
});
