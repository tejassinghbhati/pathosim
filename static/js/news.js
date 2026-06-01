// ═══════════════════════════════════════════════════════
//  news.js — Milestone checker, headline generation, sidebar
// ═══════════════════════════════════════════════════════

const FALLBACK_HEADLINES = {
  'day3':           { source:'Reuters',      sev:'normal',   text: c => `${c} authorities investigate cluster of severe respiratory illness` },
  'day7':           { source:'BBC World',    sev:'normal',   text: c => `Cases double in ${c} as officials struggle to contain the spread` },
  'day14':          { source:'AP News',      sev:'warning',  text: c => `${c} confirms sustained human-to-human transmission; borders placed on alert` },
  'spread5':        { source:'Bloomberg',    sev:'warning',  text: c => `Outbreak crosses borders — cases now reported in 5 countries beyond ${c}` },
  'spread15':       { source:'Reuters',      sev:'warning',  text: () => `WHO activates Emergency Response Committee as outbreak reaches 15 nations` },
  'spread30':       { source:'CNN',          sev:'critical', text: () => `Outbreak formally declared a global pandemic — 30+ nations report active transmission` },
  'deaths1k':       { source:'AP News',      sev:'warning',  text: c => `${c} declares national emergency; global death toll crosses 1,000` },
  'deaths10k':      { source:'The Guardian', sev:'warning',  text: () => `Global death toll surpasses 10,000 — governments accelerate emergency procurement` },
  'deaths100k':     { source:'Reuters',      sev:'critical', text: () => `WHO declares Public Health Emergency of International Concern as deaths top 100,000` },
  'deaths1m':       { source:'BBC World',    sev:'critical', text: () => `One million dead: world leaders convene emergency summit on coordinated pandemic response` },
  'deaths10m':      { source:'AP News',      sev:'critical', text: () => `Death toll reaches 10 million — health systems in collapse across more than 40 nations` },
  'vaccine':        { source:'Reuters',      sev:'normal',   text: () => `Breakthrough: Lead vaccine candidate demonstrates 94% efficacy in Phase III trials` },
  'vaccineRollout': { source:'Bloomberg',    sev:'normal',   text: () => `Mass vaccination begins — governments race to inoculate at-risk populations` },
  'month6':         { source:'Al Jazeera',   sev:'warning',  text: () => `Six months in: IMF estimates $4.7 trillion in economic damage as restrictions continue` },
  'month12':        { source:'CNN',          sev:'warning',  text: () => `One year in: pandemic has permanently reshaped global supply chains, travel, and public health` },
};

const newsCache = new Map();
let newsCount = 0;

// ── Milestone detection ───────────────────────────────
function checkMilestones(snap, prevSnap) {
  const events = [];
  const d      = snap.totalDeaths;
  const pd     = prevSnap ? prevSnap.totalDeaths : 0;
  const ca     = snap.countriesAffected;
  const pca    = prevSnap ? prevSnap.countriesAffected : 0;
  const day    = snap.day;

  if (day === 3)  events.push('day3');
  if (day === 7)  events.push('day7');
  if (day === 14) events.push('day14');

  if (ca >= 5  && pca < 5)  events.push('spread5');
  if (ca >= 15 && pca < 15) events.push('spread15');
  if (ca >= 30 && pca < 30) events.push('spread30');

  if (d >= 1e3 && pd < 1e3) events.push('deaths1k');
  if (d >= 1e4 && pd < 1e4) events.push('deaths10k');
  if (d >= 1e5 && pd < 1e5) events.push('deaths100k');
  if (d >= 1e6 && pd < 1e6) events.push('deaths1m');
  if (d >= 1e7 && pd < 1e7) events.push('deaths10m');

  if (day >= 179 && (!prevSnap || prevSnap.day < 179)) events.push('month6');
  if (day >= 364 && (!prevSnap || prevSnap.day < 364)) events.push('month12');

  return events;
}

// ── Headline generation (API or fallback) ─────────────
async function generateHeadline(milestoneId, originName, snap, apiKey) {
  if (newsCache.has(milestoneId)) return newsCache.get(milestoneId);

  const fb = FALLBACK_HEADLINES[milestoneId];
  const fallback = fb ? { source: fb.source, sev: fb.sev, text: fb.text(originName) } : null;

  if (apiKey) {
    try {
      const res = await fetch('/api/headline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key:            apiKey,
          milestone_id:       milestoneId,
          origin_name:        originName,
          day:                snap.day,
          total_deaths:       snap.totalDeaths,
          countries_affected: snap.countriesAffected,
        }),
      });
      if (res.ok) {
        const data  = await res.json();
        const item  = { source: data.source, sev: fb ? fb.sev : 'normal', text: data.text };
        newsCache.set(milestoneId, item);
        return item;
      }
    } catch (e) { /* fall through */ }
  }

  if (fallback) newsCache.set(milestoneId, fallback);
  return fallback;
}

// ── Add item to sidebar ───────────────────────────────
function addNewsItem(day, item, startDate) {
  if (!item) return;

  const list = document.getElementById('news-list');
  const placeholder = list.querySelector('.news-placeholder');
  if (placeholder) placeholder.remove();

  const date    = new Date(startDate);
  date.setDate(date.getDate() + day);
  const dateStr = date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });

  newsCount++;
  document.getElementById('news-count').textContent = newsCount + ' REPORTS';
  document.getElementById('news-dot').classList.add('live');

  const el = document.createElement('div');
  el.className = 'news-item'
    + (item.sev === 'critical' ? ' critical' : item.sev === 'warning' ? ' warning' : '');
  el.innerHTML = `
    <div class="news-meta">
      <span class="news-source">${item.source}</span>
      <span class="news-sep">·</span>
      <span class="news-day">Day ${day} — ${dateStr}</span>
    </div>
    <div class="news-headline">${item.text}</div>`;
  list.insertBefore(el, list.firstChild);
}

function resetNews() {
  newsCount = 0;
  newsCache.clear();
  document.getElementById('news-count').textContent = '0 REPORTS';
  document.getElementById('news-dot').classList.remove('live');
  document.getElementById('news-list').innerHTML =
    '<div class="news-placeholder">MONITORING SITUATION — AWAITING REPORTS</div>';
}
