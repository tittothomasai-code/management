# DD world resources

- `assets/land.geojson`: Natural Earth 1:110m land polygons, public domain. Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson. Licence: https://www.naturalearthdata.com/about/terms-of-use/. Coastline context only; no operational survey or terrain claim.
- Three.js: existing Robotyx vendored version160 in `../vendor/three.module.js`, MIT licence in `../vendor/three-license`. No second renderer library or CDN is added.
- Globe texture colours, stars, sky, sun glow, ground texture, wellhead symbols and location beacon: authored for this module. Ground height and wellhead geometry are schematic. Sun/shadow treatment follows the existing Robotyx Mining view's tone mapping and soft-shadow approach.
- Private field geometry and filed well plans: loaded only through the existing authenticated Robotyx connection and EDM/Drive permissions. No real well records, source files or coordinates are bundled in this module. Map geometry, texture assets and sun calculations never supply steering, survey alignment or collision clearance.
