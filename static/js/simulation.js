// ═══════════════════════════════════════════════════════
//  simulation.js — City-node SEIR engine
//  Depends on: cities.js (CITIES, TIER_PARAMS, cityDist)
// ═══════════════════════════════════════════════════════

const DAYS       = 730;
const SEED_CASES = 500;   // initial exposed in origin city

function computeAllSnapshots(params) {
  const { originCityIdx, r0, incubDays, mortalityRate, vaccineMonths } = params;

  // ── Initialise per-city SEIR state ───────────────────
  const states = CITIES.map(c => {
    const N = c.pop * 1_000_000;
    return { S: N, E: 0, I: 0, R: 0, D: 0, N };
  });

  const seed = Math.min(SEED_CASES, states[originCityIdx].S);
  states[originCityIdx].S -= seed;
  states[originCityIdx].E  = seed;

  const gamma      = 1 / 7;            // infectious period ~7 days
  const sigma      = 1 / incubDays;
  const vaccineDay = vaccineMonths * 30;

  const snapshots = [];

  for (let day = 0; day < DAYS; day++) {
    const vaccineActive = day >= vaccineDay;

    // ── Cross-city spread ────────────────────────────
    const newExp = new Float64Array(CITIES.length);

    for (let si = 0; si < CITIES.length; si++) {
      const ss = states[si];
      if (ss.I < 0.5) continue;
      const infecFrac = ss.I / ss.N;
      const src       = CITIES[si];

      for (let di = 0; di < CITIES.length; di++) {
        if (si === di) continue;
        const dd = states[di];
        if (dd.S < 1) continue;

        const dst  = CITIES[di];
        const dist = cityDist(src.lat, src.lng, dst.lat, dst.lng);
        const w    = travelWeight(src, dst, dist);
        const delta = infecFrac * w * 0.008 * dd.S;
        if (delta > 0.01) newExp[di] += delta;
      }
    }

    // ── Within-city SEIR (ML-predicted healthcare params) ─
    for (let i = 0; i < CITIES.length; i++) {
      const s  = states[i];
      // Use ML-predicted per-city multipliers if available;
      // fall back to tier lookup so the sim works without ML
      const ml   = (params.cityMLParams && params.cityMLParams[i]) || null;
      const tier = TIER_PARAMS[CITIES[i].tier] || TIER_PARAMS[2];
      const betaMult = ml ? ml.beta_mult : tier.betaMult;
      const cfrMult  = ml ? ml.cfr_mult  : tier.cfrMult;
      const beta = r0 * gamma * betaMult;
      const cfr  = mortalityRate * cfrMult;

      const foi = beta * (s.I / s.N);
      let dS = -foi * s.S;
      let dE = foi * s.S + newExp[i] - sigma * s.E;
      let dI = sigma * s.E - gamma * s.I;
      let dR = gamma * s.I;

      if (vaccineActive && s.S > 0) {
        const v = s.S * 0.018;   // ~1.8% of susceptibles vaccinated per day at peak
        dS -= v;
        dR += v;
      }

      const deaths = Math.max(0, dR * cfr);
      dR -= deaths;

      // Apply cross-city exposure (subtract from S, add to E via dE above)
      s.S = Math.max(0, s.S + dS - newExp[i]);
      s.E = Math.max(0, s.E + dE);
      s.I = Math.max(0, s.I + dI);
      s.R = Math.max(0, s.R + dR);
      s.D += deaths;
    }

    // ── Build snapshot ───────────────────────────────
    const snap        = { day, cityData: [], countries: {} };
    let totalCases    = 0;
    let totalDeaths   = 0;
    let totalActive   = 0;
    const countrySet  = new Set();
    const countryAgg  = {};   // iso → {active, N, D}

    for (let i = 0; i < CITIES.length; i++) {
      const s    = states[i];
      const city = CITIES[i];

      // Lightweight per-city snapshot (avoids storing full state for every city/day)
      snap.cityData.push({ D: s.D, active: s.E + s.I, N: s.N });

      totalCases  += s.E + s.I + s.R + s.D;
      totalDeaths += s.D;
      totalActive += s.E + s.I;

      if (s.D > 0 || s.I > 0 || s.E > 0) countrySet.add(city.iso);

      if (!countryAgg[city.iso]) countryAgg[city.iso] = { active: 0, N: 0, D: 0 };
      countryAgg[city.iso].active += s.E + s.I;
      countryAgg[city.iso].N      += s.N;
      countryAgg[city.iso].D      += s.D;
    }

    snap.countries         = countryAgg;
    snap.totalCases        = totalCases;
    snap.totalDeaths       = totalDeaths;
    snap.totalActive       = totalActive;
    snap.countriesAffected = countrySet.size;
    snapshots.push(snap);
  }

  return snapshots;
}

// ── Travel weight between two cities ─────────────────
function travelWeight(src, dst, dist) {
  const hubFactor  = (src.hub + dst.hub) / 2;
  const distFactor = Math.exp(-dist / 5000);   // exponential decay, softer than country model
  return (0.15 + 0.45 * distFactor + 0.40 * hubFactor);
}
