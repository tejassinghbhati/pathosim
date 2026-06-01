// ═══════════════════════════════════════════════════════
//  simulation.js — SEIR engine, pre-computes all 730 days
//  Depends on: data.js (COUNTRIES)
// ═══════════════════════════════════════════════════════

const DAYS = 730;
const SEED_EXPOSED = 1000;
const HUB_ISOS = new Set(['US','GB','CN','AE','DE','SG','JP','FR','BR','NL','KR','AU','CA','TR']);

function computeAllSnapshots(params) {
  const { originIso, r0, incubDays, mortalityRate, vaccineMonths } = params;

  // Initialise per-country SEIR state
  const state = {};
  COUNTRIES.forEach(c => {
    const N = c.pop * 1e6;
    state[c.iso] = { S: N, E: 0, I: 0, R: 0, D: 0, N };
  });

  // Seed the origin country
  const s0 = state[originIso];
  if (s0) {
    const seed = Math.min(SEED_EXPOSED, s0.S);
    s0.S -= seed;
    s0.E  = seed;
  }

  const gamma       = 1 / 7;           // ~7-day infectious period
  const sigma       = 1 / incubDays;   // incubation rate
  const vaccineDay  = vaccineMonths * 30;
  const snapshots   = [];

  for (let day = 0; day < DAYS; day++) {
    const vaccineActive = day >= vaccineDay;

    // ── Inter-country spread ──────────────────────────
    const newExp = {};
    COUNTRIES.forEach(c => { newExp[c.iso] = 0; });

    COUNTRIES.forEach(src => {
      const ss = state[src.iso];
      if (ss.I < 1) return;
      const infecFrac = ss.I / ss.N;

      COUNTRIES.forEach(dst => {
        if (dst.iso === src.iso) return;
        const dd = state[dst.iso];
        if (dd.S < 1) return;
        const dist  = haversine(src.lat, src.lng, dst.lat, dst.lng);
        const w     = travelWeight(src, dst, dist);
        const delta = infecFrac * w * 0.015 * dd.S;
        if (delta > 0.01) newExp[dst.iso] += delta;
      });
    });

    // ── Within-country SEIR + vaccine ────────────────
    COUNTRIES.forEach(c => {
      const s    = state[c.iso];
      const beta = r0 * gamma;
      const foi  = beta * (s.I / s.N);

      let dS = -foi * s.S;
      let dE = foi * s.S + newExp[c.iso] - sigma * s.E;
      let dI = sigma * s.E - gamma * s.I;
      let dR = gamma * s.I;

      if (vaccineActive && s.S > 0) {
        const v = s.S * 0.02;  // 2% of susceptible vaccinated per day
        dS -= v;
        dR += v;
      }

      const newDeaths = dR * mortalityRate;
      dR -= newDeaths;

      s.S = Math.max(0, s.S + dS - newExp[c.iso]);
      s.E = Math.max(0, s.E + dE);
      s.I = Math.max(0, s.I + dI);
      s.R = Math.max(0, s.R + dR);
      s.D += Math.max(0, newDeaths);
    });

    // ── Snapshot ─────────────────────────────────────
    const snap = { day, countries: {} };
    let totalCases = 0, totalDeaths = 0, totalActive = 0, countriesAffected = 0;

    COUNTRIES.forEach(c => {
      const s = state[c.iso];
      snap.countries[c.iso] = { S:s.S, E:s.E, I:s.I, R:s.R, D:s.D, N:s.N };
      totalCases  += s.E + s.I + s.R + s.D;
      totalDeaths += s.D;
      totalActive += s.I + s.E;
      if (s.D > 0 || s.I > 0 || s.E > 0) countriesAffected++;
    });

    snap.totalCases         = totalCases;
    snap.totalDeaths        = totalDeaths;
    snap.totalActive        = totalActive;
    snap.countriesAffected  = countriesAffected;
    snapshots.push(snap);
  }

  return snapshots;
}

function haversine(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat/2)**2
             + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function travelWeight(src, dst, dist) {
  const hubBoost  = (HUB_ISOS.has(src.iso) ? 1 : 0) + (HUB_ISOS.has(dst.iso) ? 1 : 0);
  const distFactor = Math.exp(-dist / 8000);
  return (0.2 + 0.4 * distFactor + 0.4 * (hubBoost / 2)) * src.hub * dst.hub;
}
