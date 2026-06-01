warning: in the working copy of 'static/css/main.css', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'templates/index.html', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/static/css/main.css b/static/css/main.css[m
[1mindex c066269..5c89bce 100644[m
[1m--- a/static/css/main.css[m
[1m+++ b/static/css/main.css[m
[36m@@ -1,15 +1,12 @@[m
 /* ═══════════════════════════════════════════[m
[31m-   PATHOSIM — Global Epidemic Intelligence System[m
[31m-   main.css[m
[32m+[m[32m   PATHOSIM — main.css[m
 ═══════════════════════════════════════════ */[m
[31m-[m
 *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }[m
 [m
 :root {[m
   --navy:      #060b18;[m
   --navy2:     #0a1020;[m
   --navy3:     #0d1530;[m
[31m-  --navy4:     #111e3a;[m
   --border:    #1a2d52;[m
   --border2:   #243a68;[m
   --blue:      #3d8fef;[m
[36m@@ -17,7 +14,6 @@[m
   --cyan:      #00d4ff;[m
   --amber:     #f5a623;[m
   --red:       #ff3b30;[m
[31m-  --red-dim:   #7a1010;[m
   --green:     #32d74b;[m
   --text:      #c8d4f0;[m
   --text-dim:  #5a6e96;[m
[36m@@ -52,12 +48,10 @@[m [mbody {[m
 #top-header::after {[m
   content: '';[m
   position: absolute;[m
[31m-  bottom: 0; left: 0; right: 0;[m
[31m-  height: 1px;[m
[32m+[m[32m  bottom: 0; left: 0; right: 0; height: 1px;[m
   background: linear-gradient(90deg, transparent, var(--blue) 30%, var(--cyan) 50%, var(--blue) 70%, transparent);[m
   opacity: 0.4;[m
 }[m
[31m-[m
 .brand-block {[m
   display: flex;[m
   flex-direction: column;[m
[36m@@ -80,7 +74,6 @@[m [mbody {[m
   color: var(--text-dim);[m
   margin-top: 2px;[m
 }[m
[31m-[m
 .stats-grid {[m
   display: flex;[m
   flex: 1;[m
[36m@@ -94,7 +87,6 @@[m [mbody {[m
   align-items: center;[m
   padding: 0 8px;[m
   border-right: 1px solid var(--border);[m
[31m-  transition: background 0.3s;[m
 }[m
 .stat-cell.alert { background: rgba(255,59,48,0.05); }[m
 .stat-lbl {[m
[36m@@ -111,12 +103,11 @@[m [mbody {[m
   transition: color 0.3s;[m
 }[m
 .stat-val.v-cases   { color: var(--amber); }[m
[31m-.stat-val.v-deaths  { color: var(--red); text-shadow: 0 0 10px rgba(255,59,48,0.35); }[m
[32m+[m[32m.stat-val.v-deaths  { color: var(--red); text-shadow: 0 0 10px rgba(255,59,48,0.3); }[m
 .stat-val.v-active  { color: var(--cyan); }[m
 .stat-val.v-nations { color: var(--blue); }[m
 .stat-val.v-cfr     { color: #cc88ff; }[m
 .stat-val.v-r0      { color: var(--green); }[m
[31m-[m
 .header-right {[m
   display: flex;[m
   flex-direction: column;[m
[36m@@ -130,7 +121,6 @@[m [mbody {[m
   font-family: var(--mono);[m
   font-size: 12px;[m
   color: var(--cyan);[m
[31m-  text-shadow: 0 0 8px rgba(0,212,255,0.25);[m
   letter-spacing: 0.5px;[m
 }[m
 #model-label {[m
[36m@@ -141,7 +131,6 @@[m [mbody {[m
   margin-top: 3px;[m
   font-family: var(--mono);[m
 }[m
[31m-[m
 .status-dot {[m
   display: inline-block;[m
   width: 6px; height: 6px;[m
[36m@@ -163,11 +152,7 @@[m [mbody {[m
 /* ═══════════════════════════════════════════[m
    MAIN LAYOUT[m
 ═══════════════════════════════════════════ */[m
[31m-#main {[m
[31m-  display: flex;[m
[31m-  flex: 1;[m
[31m-  overflow: hidden;[m
[31m-}[m
[32m+[m[32m#main { display:flex; flex:1; overflow:hidden; }[m
 [m
 /* ═══════════════════════════════════════════[m
    MAP[m
[36m@@ -178,96 +163,107 @@[m [mbody {[m
   overflow: hidden;[m
   background: var(--navy);[m
 }[m
[31m-#map-wrap svg { width:100%; height:100%; display:block; }[m
[32m+[m
[32m+[m[32m/* Leaflet overrides */[m
[32m+[m[32m.leaflet-container {[m
[32m+[m[32m  background: #060e1c !important;[m
[32m+[m[32m  font-family: var(--ui) !important;[m
[32m+[m[32m}[m
[32m+[m[32m.leaflet-control-zoom {[m
[32m+[m[32m  border: 1px solid var(--border2) !important;[m
[32m+[m[32m  border-radius: 5px !important;[m
[32m+[m[32m  overflow: hidden;[m
[32m+[m[32m}[m
[32m+[m[32m.leaflet-control-zoom a {[m
[32m+[m[32m  background: var(--navy2) !important;[m
[32m+[m[32m  color: var(--text-dim) !important;[m
[32m+[m[32m  border-bottom: 1px solid var(--border) !important;[m
[32m+[m[32m  font-size: 16px !important;[m
[32m+[m[32m  line-height: 28px !important;[m
[32m+[m[32m  width: 28px !important;[m
[32m+[m[32m  height: 28px !important;[m
[32m+[m[32m}[m
[32m+[m[32m.leaflet-control-zoom a:hover {[m
[32m+[m[32m  background: var(--navy3) !important;[m
[32m+[m[32m  color: var(--cyan) !important;[m
[32m+[m[32m}[m
[32m+[m[32m.leaflet-control-attribution {[m
[32m+[m[32m  background: rgba(6,11,24,0.75) !important;[m
[32m+[m[32m  color: var(--text-muted) !important;[m
[32m+[m[32m  font-size: 9px !important;[m
[32m+[m[32m}[m
[32m+[m[32m.leaflet-control-attribution a { color: var(--text-muted) !important; }[m
[32m+[m
[32m+[m[32m/* Country GeoJSON layers */[m
[32m+[m[32m.country-layer {[m
[32m+[m[32m  cursor: pointer;[m
[32m+[m[32m  transition: fill-opacity 0.2s;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m/* Death dot canvas — positioned by renderer.js */[m
 #dot-canvas {[m
   position: absolute;[m
[31m-  top:0; left:0;[m
[32m+[m[32m  top: 0; left: 0;[m
   pointer-events: none;[m
[31m-  width:100%; height:100%;[m
[32m+[m[32m  z-index: 450;[m
 }[m
[32m+[m
[32m+[m[32m/* Vignette */[m
 #map-wrap::after {[m
   content: '';[m
   position: absolute;[m
   inset: 0;[m
[31m-  background: radial-gradient(ellipse at center, transparent 60%, rgba(6,11,24,0.65) 100%);[m
[32m+[m[32m  background: radial-gradient(ellipse at center, transparent 55%, rgba(6,11,24,0.55) 100%);[m
   pointer-events: none;[m
[31m-  z-index: 2;[m
[32m+[m[32m  z-index: 400;[m
 }[m
 [m
[31m-.country {[m
[31m-  stroke: #0f1e38;[m
[31m-  stroke-width: 0.5;[m
[31m-  cursor: pointer;[m
[31m-  transition: fill 0.5s ease;[m
[31m-}[m
[31m-.country.unaffected  { fill: #0f1e38; }[m
[31m-.country.early       { fill: #5c2800; }[m
[31m-.country.widespread  { fill: #a04000; }[m
[31m-.country.overwhelmed { fill: #cc2000; }[m
[31m-.country.origin      { fill: #8b0000; stroke: #ff3b30; stroke-width: 1.2; filter: drop-shadow(0 0 4px rgba(255,59,48,0.6)); }[m
[31m-.country:hover       { filter: brightness(1.5) drop-shadow(0 0 3px rgba(61,143,239,0.35)); }[m
[31m-[m
[32m+[m[32m/* Tooltip */[m
 #tooltip {[m
   position: absolute;[m
[31m-  background: rgba(10,16,32,0.95);[m
[32m+[m[32m  background: rgba(8,14,30,0.97);[m
   border: 1px solid var(--border2);[m
[31m-  border-radius: 4px;[m
[31m-  padding: 8px 12px;[m
[32m+[m[32m  border-radius: 5px;[m
[32m+[m[32m  padding: 9px 13px;[m
   font-family: var(--mono);[m
   font-size: 11px;[m
   color: var(--text);[m
   pointer-events: none;[m
   display: none;[m
[31m-  z-index: 20;[m
[32m+[m[32m  z-index: 1000;[m
   white-space: nowrap;[m
[31m-  box-shadow: 0 4px 20px rgba(0,0,0,0.5);[m
[31m-  line-height: 1.7;[m
[32m+[m[32m  box-shadow: 0 6px 24px rgba(0,0,0,0.6);[m
[32m+[m[32m  line-height: 1.75;[m
[32m+[m[32m  min-width: 140px;[m
 }[m
[31m-.tt-name { color: var(--cyan); font-size: 12px; margin-bottom: 3px; }[m
[32m+[m[32m.tt-name { color: var(--cyan); font-size: 12px; margin-bottom: 3px; font-weight: bold; }[m
 .tt-row  { color: var(--text-dim); }[m
 .tt-val  { color: var(--text); }[m
 [m
[31m-#map-coords {[m
[32m+[m[32m/* Idle hint */[m
[32m+[m[32m#idle-hint {[m
   position: absolute;[m
[31m-  bottom: 68px;[m
[31m-  left: 14px;[m
[31m-  font-family: var(--mono);[m
[31m-  font-size: 10px;[m
[31m-  color: var(--text-muted);[m
[32m+[m[32m  top: 50%; left: 50%;[m
[32m+[m[32m  transform: translate(-50%, -50%);[m
[32m+[m[32m  text-align: center;[m
   pointer-events: none;[m
[31m-  z-index: 5;[m
[32m+[m[32m  z-index: 500;[m
 }[m
[31m-[m
[31m-#legend {[m
[31m-  position: absolute;[m
[31m-  bottom: 68px;[m
[31m-  right: 14px;[m
[31m-  z-index: 5;[m
[31m-  background: rgba(10,16,32,0.88);[m
[31m-  border: 1px solid var(--border);[m
[31m-  border-radius: 6px;[m
[31m-  padding: 10px 14px;[m
[32m+[m[32m.hint-text {[m
   font-family: var(--mono);[m
[31m-  font-size: 10px;[m
[31m-}[m
[31m-.legend-row {[m
[31m-  display: flex;[m
[31m-  align-items: center;[m
[31m-  gap: 8px;[m
[31m-  margin-bottom: 5px;[m
[31m-  color: var(--text-dim);[m
[31m-}[m
[31m-.legend-row:last-child { margin-bottom: 0; }[m
[31m-.legend-swatch {[m
[31m-  width: 10px; height: 10px;[m
[31m-  border-radius: 2px;[m
[31m-  flex-shrink: 0;[m
[32m+[m[32m  font-size: 11px;[m
[32m+[m[32m  color: var(--text-muted);[m
[32m+[m[32m  letter-spacing: 2px;[m
[32m+[m[32m  border: 1px solid var(--border);[m
[32m+[m[32m  padding: 10px 20px;[m
[32m+[m[32m  border-radius: 4px;[m
[32m+[m[32m  background: rgba(6,11,24,0.7);[m
 }[m
 [m
[32m+[m[32m/* Reconfigure button */[m
 #reconfigure-btn {[m
   position: absolute;[m
[31m-  top: 12px;[m
[31m-  left: 12px;[m
[32m+[m[32m  top: 12px; left: 50px;[m
   background: rgba(13,21,48,0.92);[m
   border: 1px solid var(--border2);[m
   border-radius: 4px;[m
[36m@@ -277,30 +273,88 @@[m [mbody {[m
   letter-spacing: 1px;[m
   padding: 6px 12px;[m
   cursor: pointer;[m
[31m-  z-index: 20;[m
[32m+[m[32m  z-index: 500;[m
   display: none;[m
   transition: all 0.15s;[m
 }[m
 #reconfigure-btn:hover { border-color: var(--blue); color: var(--blue); }[m
 [m
[31m-#idle-hint {[m
[32m+[m[32m/* Map controls panel */[m
[32m+[m[32m#map-controls {[m
   position: absolute;[m
[31m-  top: 50%;[m
[31m-  left: 50%;[m
[31m-  transform: translate(-50%, -50%);[m
[31m-  text-align: center;[m
[31m-  pointer-events: none;[m
[31m-  z-index: 5;[m
[32m+[m[32m  top: 12px; right: 14px;[m
[32m+[m[32m  background: rgba(8,14,30,0.92);[m
[32m+[m[32m  border: 1px solid var(--border);[m
[32m+[m[32m  border-radius: 6px;[m
[32m+[m[32m  padding: 10px 12px;[m
[32m+[m[32m  z-index: 500;[m
[32m+[m[32m  display: flex;[m
[32m+[m[32m  flex-direction: column;[m
[32m+[m[32m  gap: 5px;[m
[32m+[m[32m  min-width: 100px;[m
 }[m
[31m-.hint-text {[m
[32m+[m[32m.mc-label {[m
   font-family: var(--mono);[m
[31m-  font-size: 11px;[m
[31m-  color: var(--text-muted);[m
[32m+[m[32m  font-size: 8px;[m
   letter-spacing: 2px;[m
[32m+[m[32m  color: var(--text-muted);[m
[32m+[m[32m  text-transform: uppercase;[m
[32m+[m[32m  margin-top: 2px;[m
[32m+[m[32m}[m
[32m+[m[32m.mc-label:first-child { margin-top: 0; }[m
[32m+[m[32m.mc-btn {[m
[32m+[m[32m  background: var(--navy);[m
   border: 1px solid var(--border);[m
[31m-  padding: 10px 20px;[m
   border-radius: 4px;[m
[31m-  background: rgba(6,11,24,0.6);[m
[32m+[m[32m  color: var(--text-dim);[m
[32m+[m[32m  font-family: var(--mono);[m
[32m+[m[32m  font-size: 9px;[m
[32m+[m[32m  letter-spacing: 1px;[m
[32m+[m[32m  padding: 5px 8px;[m
[32m+[m[32m  cursor: pointer;[m
[32m+[m[32m  text-transform: uppercase;[m
[32m+[m[32m  transition: all 0.15s;[m
[32m+[m[32m  text-align: left;[m
[32m+[m[32m}[m
[32m+[m[32m.mc-btn:hover { border-color: var(--border2); color: var(--text); }[m
[32m+[m[32m.mc-btn.active { background: var(--blue-dim); border-color: var(--blue); color: var(--blue); }[m
[32m+[m[32m.mc-divider {[m
[32m+[m[32m  height: 1px;[m
[32m+[m[32m  background: var(--border);[m
[32m+[m[32m  margin: 4px 0;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m/* Legend */[m
[32m+[m[32m#legend {[m
[32m+[m[32m  position: absolute;[m
[32m+[m[32m  bottom: 62px; left: 14px;[m
[32m+[m[32m  z-index: 500;[m
[32m+[m[32m  background: rgba(8,14,30,0.92);[m
[32m+[m[32m  border: 1px solid var(--border);[m
[32m+[m[32m  border-radius: 6px;[m
[32m+[m[32m  padding: 10px 14px;[m
[32m+[m[32m  font-family: var(--mono);[m
[32m+[m[32m  font-size: 10px;[m
[32m+[m[32m}[m
[32m+[m[32m.legend-title {[m
[32m+[m[32m  font-size: 8px;[m
[32m+[m[32m  letter-spacing: 2px;[m
[32m+[m[32m  text-transform: uppercase;[m
[32m+[m[32m  color: var(--text-muted);[m
[32m+[m[32m  margin-bottom: 8px;[m
[32m+[m[32m}[m
[32m+[m[32m.legend-row {[m
[32m+[m[32m  display: flex;[m
[32m+[m[32m  align-items: center;[m
[32m+[m[32m  gap: 8px;[m
[32m+[m[32m  margin-bottom: 5px;[m
[32m+[m[32m  color: var(--text-dim);[m
[32m+[m[32m}[m
[32m+[m[32m.legend-row:last-child { margin-bottom: 0; }[m
[32m+[m[32m.legend-swatch {[m
[32m+[m[32m  width: 10px; height: 10px;[m
[32m+[m[32m  border-radius: 2px;[m
[32m+[m[32m  flex-shrink: 0;[m
 }[m
 [m
 /* ═══════════════════════════════════════════[m
[36m@@ -343,16 +397,14 @@[m [mbody {[m
 }[m
 #news-list::-webkit-scrollbar { width: 3px; }[m
 #news-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }[m
[31m-[m
 .news-placeholder {[m
   padding: 20px 16px;[m
   font-family: var(--mono);[m
   font-size: 10px;[m
   color: var(--text-muted);[m
[31m-  line-height: 1.8;[m
[32m+[m[32m  line-height: 1.9;[m
   letter-spacing: 0.5px;[m
 }[m
[31m-[m
 .news-item {[m
   padding: 11px 16px 13px;[m
   border-bottom: 1px solid rgba(26,45,82,0.4);[m
[36m@@ -369,17 +421,11 @@[m [mbody {[m
 }[m
 .news-item.critical::before { background: var(--red); }[m
 .news-item.warning::before  { background: var(--amber); }[m
[31m-[m
 @keyframes slideIn {[m
   from { opacity:0; transform:translateX(8px); }[m
   to   { opacity:1; transform:none; }[m
 }[m
[31m-[m
[31m-.news-meta {[m
[31m-  display: flex;[m
[31m-  align-items: center;[m
[31m-  margin-bottom: 5px;[m
[31m-}[m
[32m+[m[32m.news-meta { display:flex; align-items:center; margin-bottom:5px; }[m
 .news-source {[m
   font-family: var(--mono);[m
   font-size: 9px;[m
[36m@@ -389,18 +435,8 @@[m [mbody {[m
   color: var(--blue);[m
 }[m
 .news-sep { color: var(--text-muted); margin: 0 6px; font-size: 9px; }[m
[31m-.news-day {[m
[31m-  font-family: var(--mono);[m
[31m-  font-size: 9px;[m
[31m-  color: var(--text-muted);[m
[31m-}[m
[31m-.news-headline {[m
[31m-  font-size: 12px;[m
[31m-  font-weight: 500;[m
[31m-  color: var(--text);[m
[31m-  line-height: 1.55;[m
[31m-}[m
[31m-[m
[32m+[m[32m.news-day { font-family: var(--mono); font-size: 9px; color: var(--text-muted); }[m
[32m+[m[32m.news-headline { font-size: 12px; font-weight: 500; color: var(--text); line-height: 1.55; }[m
 #analytics-panel {[m
   border-top: 1px solid var(--border);[m
   padding: 14px 16px;[m
[36m@@ -454,7 +490,6 @@[m [mbody {[m
 }[m
 #play-btn:hover  { background: var(--blue-dim); border-color: var(--blue); }[m
 #play-btn.playing { border-color: var(--red); color: var(--red); }[m
[31m-[m
 .timeline-track {[m
   flex: 1;[m
   display: flex;[m
[36m@@ -462,15 +497,8 @@[m [mbody {[m
   justify-content: center;[m
   gap: 4px;[m
 }[m
[31m-.timeline-ticks {[m
[31m-  display: flex;[m
[31m-  justify-content: space-between;[m
[31m-}[m
[31m-.timeline-tick {[m
[31m-  font-family: var(--mono);[m
[31m-  font-size: 8px;[m
[31m-  color: var(--text-muted);[m
[31m-}[m
[32m+[m[32m.timeline-ticks { display:flex; justify-content:space-between; }[m
[32m+[m[32m.timeline-tick { font-family: var(--mono); font-size: 8px; color: var(--text-muted); }[m
 #scrubber {[m
   width: 100%;[m
   -webkit-appearance: none;[m
[36m@@ -494,7 +522,6 @@[m [mbody {[m
   background: var(--blue);[m
   border: none;[m
 }[m
[31m-[m
 .timeline-info {[m
   display: flex;[m
   flex-direction: column;[m
[36m@@ -502,17 +529,8 @@[m [mbody {[m
   min-width: 170px;[m
   text-align: right;[m
 }[m
[31m-#timeline-date {[m
[31m-  font-family: var(--mono);[m
[31m-  font-size: 11p