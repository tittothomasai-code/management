# Desktop dock (v5.10.1, dock.js)
Desktop only (window width >= 1024 px). Phone layout is not changed.
- Panels (Data, Slide sheet, Tools, Well plan, Crew) dock at the right side and stay open over the 3D view. Several can be open at once (v5.8 ui.js dock).
- New: each docked panel has a collapse button (⇥). A collapsed panel is a 40 px strip with its name; select the strip to expand it.
- Resize: drag the left edge of a panel (v5.8).
- The open panels, their widths, the active panel and the collapsed panels are saved in localStorage `dw_desk` and come back on reload.
- Split subsurface view: when panels are docked, the rig and the subsurface view share the free space between the left nav (104 px) and the dock. The rig render width is set with `window.dwSplitView(mid)`. With no panels docked, the split is the normal half and half.
- On-screen controls (vpad.js `#vpad`, `#vpToggle`): on desktop they move left of the dock (CSS uses `--dkR`).
