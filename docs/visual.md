# Visual quality (feat/visual)
- Quality setting: Low / Medium / High, saved in localStorage `dw_quality`; `?q=low|medium|high` overrides. Phone (coarse pointer or short side < 600 px) defaults to Low; desktop defaults to High. Button `#qualityBtn` (in #hud / Tools) cycles levels. API: `GX.quality.get()/set(l)`.
- Low: pixel ratio 1, no shadows, procedural sky env, extra detail hidden, small parts hidden beyond 60 m.
- Medium: pixel ratio ≤1.5, 1024 PCF shadows, HDRI env, detail on, LOD 140 m.
- High: pixel ratio ≤2, 2048 PCF-soft shadows, HDRI env, detail on, LOD 400 m.
- PBR: steel/pipe/paint materials get procedural roughness + bump maps (brushed and worn), metalness tuned for image-based lighting.
- HDRI: Poly Haven "Kloofendal 48d Partly Cloudy Pure Sky" 1k, CC0 (CREDITS.md). Prefiltered with PMREM.
- Extra detail (procedural): pump pulsation dampener, discharge and suction lines, electric motor with fins, belt guard; standpipe and top-drive service loop (follows the top drive); racked stands in setback; mast lights; BOP accumulator unit; choke manifold.
- Pump and top-drive animations stay in main.js/anim.js and are not changed.
