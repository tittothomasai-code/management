# Dock split view (feat/dock-split)
Desktop (>= 1024 px) split subsurface view now keeps both panes (rig and subsurface) at least 360 px wide (dock.js MIN).
Order of fit, in splitFit():
1. If space < 2 x 360 px, collapse the widest open dock to a 40 px strip (auto). The dock opens again when the split closes.
2. If still too small, stack the panes (rig top, subsurface bottom 50 %).
3. Else side by side. A drag bar (#dkSplitH) between the panes sets the split. Drag is clamped so both panes stay >= 360 px.
The split fraction is saved in localStorage dw_desk.split and comes back on reload.
Sources (UI practice, not drilling physics):
- W3C WAI-ARIA Authoring Practices, "Window Splitter" pattern: https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
- MDN, Pointer events and setPointerCapture: https://developer.mozilla.org/docs/Web/API/Element/setPointerCapture
- 360 px minimum matches the common small-viewport width (phone CSS width class) used by the phone layout in this app.
