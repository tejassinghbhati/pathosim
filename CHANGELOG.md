# Changelog

All notable changes to PATHOSIM are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [2.4.1] — 2026-06-01

### Added
- Scientific `README.md` with full SEIR model derivation, governing equations,
  gravity kernel documentation, computational complexity analysis, and 10 academic references
- `.gitignore` for Python virtual environments, IDE artifacts, `.env` secrets
- `LICENSE` — MIT
- `CONTRIBUTING.md` with development setup, PR guidelines, and model contribution policy
- `CHANGELOG.md` (this file)

### Changed
- README now includes empirically anchored parameter tables (R₀, CFR, incubation)
  cross-referenced against COVID-19, SARS-2003, Influenza, and Ebola historical data

---

## [2.4.0] — 2026-05-28

### Added
- **AI Intelligence Feed**: Anthropic Claude Sonnet 4 integration for generative
  news headline synthesis keyed to 15 epidemiological milestone events
- Flask proxy server (`app.py`) for server-side API key management
- Fallback headline library covering all 15 milestones (zero-API-key operation)
- Milestone event caching (`Map`-based) to prevent duplicate API calls on scrubber rewind

### Changed
- News sidebar now shows severity-coded headlines (normal / warning / critical)
  with animated left-border indicators

---

## [2.3.0] — 2026-05-20

### Added
- **Vaccine intervention layer**: configurable timeline (6–36 months), 2%/day
  immunization rate applied globally post-availability
- Vaccine and vaccine-rollout milestone events in intelligence feed

### Changed
- Effective R (R_e) now computed and displayed in real time from origin-country
  susceptible fraction, colour-coded green/red by threshold

---

## [2.2.0] — 2026-05-14

### Added
- **Canvas mortality dot overlay**: proportional dot density rendering on HTML5
  Canvas with seeded RNG for deterministic spatial layout
- Per-country urban sub-center coordinates (up to 5 per nation) for
  geographically accurate dot placement
- Dot fade-in animation over 5-day birth window

### Changed
- Map rendering pipeline split: SVG for country fills, Canvas for dot layer
- Projection now updates correctly on window resize, redrawing both layers

---

## [2.1.0] — 2026-05-07

### Added
- **Gravity-weighted inter-country transmission kernel**
- Haversine great-circle distance computation between all country-pair centroids
- Hub connectivity boost for 14 major international aviation hub nations
- Bilateral coupling: source × destination hub-score product

### Changed
- Importation flux now scales with destination susceptible population (S_k)
  rather than fixed per-country rate, preventing super-exponential artefacts

---

## [2.0.0] — 2026-04-29

### Added
- **80-nation SEIR metapopulation model** — full rewrite from single-population prototype
- Pre-computation of complete 730-day snapshot array for scrub-anywhere playback
- D3.js Natural Earth projection world map with TopoJSON country geometries
- Interactive configuration overlay: R₀, incubation period, CFR, vaccine timeline
- Timeline scrubber with playback speed selector (slow / normal / fast)
- Per-country hover tooltip with live S/E/I/R/D readout
- Infection severity choropleth: unaffected → early → widespread → overwhelmed → origin

### Removed
- Single-country SIR prototype (superseded by metapopulation SEIR)

---

## [1.0.0] — 2026-04-01

### Added
- Initial single-country SIR simulation prototype
- Basic bar-chart visualization of S/I/R compartments over time
- R₀ and CFR parameter sliders
