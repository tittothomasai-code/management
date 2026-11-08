# Controls guide (feat/controls-guide)
- On-screen controls (vpad.js) show the keyboard key and gamepad button on each button, for example "] · RT", "[ · LT", "PgUp · RB", "PgDn · LB".
- "? Controls guide" button (keyboard ?, gamepad Start) opens the full controls legend from input.js, on top of all panels (z-index above subsurface view), with a Close button.
- Tools > Settings has a "Controls guide" entry.
- Fix: on-screen buttons now place inside their own container, so they stay on screen when the desktop dock moves #vpad.
Sources:
- W3C Gamepad API, "standard" button mapping (Start = button 9, RB/LB = 5/4, RT/LT = 7/6): https://www.w3.org/TR/gamepad/#remapping
- ASD-STE100 Simplified Technical English, Issue 9: https://www.asd-ste100.org/
