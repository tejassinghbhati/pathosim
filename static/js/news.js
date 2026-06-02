'use strict';

// ═══════════════════════════════════════════════════════
//  news.js  —  Intelligence Feed
//  Milestone detection → AI headline or rich static fallback
// ═══════════════════════════════════════════════════════

// Severity levels: 'normal' | 'warning' | 'critical' | 'positive'

const FALLBACK_HEADLINES = {
  day3:          { source:'Reuters',       sev:'normal',   text: c => `Unusual respiratory illness cluster reported in ${c}; authorities begin investigation` },
  day7:          { source:'BBC World',     sev:'normal',   text: c => `Case count doubles in ${c} as contact-tracing teams struggle to contain early spread` },
  day14:         { source:'AP News',       sev:'warning',  text: c => `${c} confirms sustained community transmission; WHO dispatches rapid-response team` },
  spread5:       { source:'Bloomberg',     sev:'warning',  text: c => `Virus crosses five international borders; ${c} outbreak escalates to regional emergency` },
  spread15:      { source:'Reuters',       sev:'warning',  text: () => `WHO activates Emergency Response Committee; 15 nations report active transmission` },
  spread30:      { source:'CNN',           sev:'critical', text: () => `PANDEMIC DECLARED — 30+ nations report active transmission; travel bans enacted globally` },
  deaths1k:      { source:'AP News',       sev:'warning',  text: c => `${c} declares national emergency as global death toll crosses 1,000` },
  deaths10k:     { source:'The Guardian',  sev:'warning',  text: () => `10,000 deaths confirmed globally — G7 emergency healthcare procurement fast-tracked` },
  deaths100k:    { source:'Reuters',       sev:'critical', text: () => `WHO declares Public Health Emergency of International Concern — 100,000 dead` },
  deaths1m:      { source:'BBC World',     sev:'critical', text: () => `One million lives lost — world leaders convene emergency pandemic summit` },
  deaths10m:     { source:'Al Jazeera',    sev:'critical', text: () => `Ten million dead — healthcare systems collapsing across more than 40 nations` },
  vaccine:       { source:'Reuters',       sev:'positive', text: () => `BREAKTHROUGH: Lead vaccine candidate clears Phase III trials with 94% efficacy` },
  vaccineRollout:{ source:'Bloomberg',     sev:'positive', text: () => `Mass vaccination campaign begins — governments race to inoculate priority groups` },
  month6:        { source:'Al Jazeera',    sev:'warning',  text: () => `Six months in: IMF revises global GDP forecast down 4.7%; no end to restrictions in sight` },
  month12:       { source:'CNN',           sev:'warning',  text: () => `One year since outbreak — pandemic has permanently reshaped global health infrastructure` },
};

const newsCache = new Map();
let newsCount   = 0;
let activeFilter = 'all';   // 'all' | 'critical' | 'warning' | 'positive'

// ── Milestone detection ───────────────────────────────
function checkMilestones(snap, prev) {
  const events = [];
  const d   = snap.totalDeaths,    pd  = prev ? prev.totalDeaths    : 0;
  const ca  = snap.countriesAffected, pca = prev ? prev.countriesAffected : 0;
  const day = snap.day;

  if (day === 3)  events.push('day3');
  if (day === 7)  events.push('day7');
  if (day === 14) events.push('day14');

  if (ca >= 5  && pca < 5)  events.push('spread5');
  if (ca >= 15 && pca < 15) events.push('spread15');
  if (ca >= 30 && pca < 30) events.push('spread30');

  if (d >= 1e3  && pd < 1e3)  events.push('deaths1k');
  if (d >= 1e4  && pd < 1e4)  events.push('deaths10k');
  if (d >= 1e5  && pd < 1e5)  events.push('deaths100k');
  if (d >= 1e6  && pd < 1e6)  events.push('deaths1m');
  if (d >= 1e7  && pd < 1e7)  events.push('deaths10m');

  if (day >= 179 && (!prev || prev.day < 179)) events.push('month6');
  if (day >= 364 && (!prev || prev.day < 364)) events.push('month12');

  return events;
}

// ── Headline generation ───────────────────────────────
async function generateHeadline(milestoneId, originName, snap, apiKey) {
  if (newsCache.has(milestoneId)) return newsCache.get(milestoneId);

  const fb       = FALLBACK_HEADLINES[milestoneId];
  const fallback = fb ? { source:fb.source, sev:fb.sev, text:fb.text(originName) } : null;

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
        const d    = await res.json();
        const item = { source:d.source, sev:fb ? fb.sev : 'normal', text:d.text };
        newsCache.set(milestoneId, item);
        return item;
      }
    } catch (_) {}
  }

  if (fallback) newsCache.set(milestoneId, fallback);
  return fallback;
}

// ── Add item to feed ──────────────────────────────────
function addNewsItem(day, item, startDate) {
  if (!item) return;

  const list = document.getElementById('news-list');
  if (!list) return;

  const placeholder = list.querySelector('.news-placeholder');
  if (placeholder) placeholder.remove();

  const date    = new Date(startDate);
  date.setDate(date.getDate() + day);
  const dateStr = date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });

  newsCount++;

  // Update count badge
  const countEl = document.getElementById('news-count');
  if (countEl) countEl.textContent = `${newsCount} REPORTS`;

  // Flash the tab button to signal new item
  const tab = document.querySelector('.rp-tab[data-pane="news"]');
  if (tab) {
    tab.classList.add('flash-tab');
    setTimeout(() => tab.classList.remove('flash-tab'), 1200);
  }

  const div = document.createElement('div');
  div.className   = `news-item${item.sev === 'critical' ? ' critical' : item.sev === 'warning' ? ' warning' : item.sev === 'positive' ? ' positive' : ''}`;
  div.dataset.sev = item.sev || 'normal';

  const sevTag = item.sev === 'critical' ? '<span class="news-sev-tag critical-tag">BREAKING</span>'
               : item.sev === 'positive' ? '<span class="news-sev-tag positive-tag">DEVELOPMENT</span>'
               : '';

  div.innerHTML = `
    <div class="news-meta">
      <span class="news-source">${item.source}</span>
      <span class="news-sep">·</span>
      <span class="news-day">Day ${day} — ${dateStr}</span>
    </div>
    <div class="news-headline">${sevTag}${item.text}</div>`;

  list.insertBefore(div, list.firstChild);

  // Apply current filter
  if (activeFilter !== 'all' && div.dataset.sev !== activeFilter) {
    div.style.display = 'none';
  }
}

// ── Filter controls ───────────────────────────────────
function initNewsFilters() {
  const filterBar = document.getElementById('news-filter-bar');
  if (!filterBar) return;

  filterBar.addEventListener('click', e => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;

    filterBar.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;

    const list = document.getElementById('news-list');
    if (!list) return;
    list.querySelectorAll('.news-item').forEach(item => {
      item.style.display = (activeFilter === 'all' || item.dataset.sev === activeFilter) ? '' : 'none';
    });
  });
}

// ── Reset ─────────────────────────────────────────────
function resetNews() {
  newsCount    = 0;
  activeFilter = 'all';
  newsCache.clear();

  const countEl = document.getElementById('news-count');
  if (countEl) countEl.textContent = '0 REPORTS';

  const list = document.getElementById('news-list');
  if (list) list.innerHTML = '<div class="news-placeholder">Monitoring situation — reports will appear as milestones are reached.</div>';

  // Reset filter bar
  const filterBar = document.getElementById('news-filter-bar');
  if (filterBar) {
    filterBar.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
    const allBtn = filterBar.querySelector('[data-filter="all"]');
    if (allBtn) allBtn.classList.add('active');
  }
}

// Initialise filters when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNewsFilters);
} else {
  initNewsFilters();
}
