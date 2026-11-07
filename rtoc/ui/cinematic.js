// Reversible cinematic camera. It moves the view and hides clutter.
// It does not change pumps, drawworks, or any other rig setpoint.
// F1 is claimed only when the host asks. input.js on the game already uses Escape
// to close panels, so Escape is handled here only while cinematic view is on.

const TYPING = /^(INPUT|TEXTAREA|SELECT)$/;

export const CAMERA_CONTRACT = {
  investigated: 'ext2.js setCam, exported as GX.camMode',
  modes: ['orbit', 'walk', 'bit'],
  f1: 'Not bound in input.js (v5.9.4).',
  escape: 'input.js closes panels and the control legend. This controller handles Escape only while cinematic view is active, then lets the next Escape through.',
  resetCam: 'vpad.js calls GX.resetCam if present. No definition of resetCam was found. This controller does not call it.',
  orbitHelpers: 'GX.input.orbit, zoom, and look when input.js has loaded.',
  pending: 'The live v5.15.1 game tree is not in this repository. Nothing here is attached to index.html.',
};

export function cinematicPose(cam) {
  const p = cam.position || [0, 0, 0];
  const t = cam.target || [0, 0, 0];
  const dx = p[0] - t[0];
  const dy = p[1] - t[1];
  const dz = p[2] - t[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  const pull = Math.min(80, len * 1.65);
  return {
    position: [t[0] + (dx / len) * pull, t[1] + Math.abs((dy / len) * pull) * 0.25 + 6, t[2] + (dz / len) * pull],
    target: t.slice(),
    controlsEnabled: false,
    mode: cam.mode ?? null,
  };
}

function typingTarget(e, doc) {
  const t = e?.target || doc?.activeElement;
  return !!(t && (TYPING.test(t.tagName || '') || t.isContentEditable));
}

export function createCinematicController(host, opts = {}) {
  if (typeof host?.read !== 'function' || typeof host?.write !== 'function') {
    throw new Error('cinematic host needs read() and write()');
  }
  const win = opts.window || globalThis;
  const doc = opts.document || win.document;
  const claimKey = opts.claimKey === true;
  const button = opts.button || null;
  let on = false;
  let snapshot = null;
  let anim = 0;

  function reduced() {
    if (typeof opts.reducedMotion === 'boolean') return opts.reducedMotion;
    try { return !!win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; } catch { return false; }
  }

  function clock() { return typeof opts.now === 'function' ? opts.now() : 0; }

  function cancelAnim() {
    if (anim && opts.cancelFrame) opts.cancelFrame(anim);
    anim = 0;
  }

  function applyPose(from, to) {
    if (reduced() || typeof opts.requestFrame !== 'function') {
      host.write({ ...from, position: to.position.slice(), target: to.target.slice(), controlsEnabled: false, mode: from.mode ?? null });
      return;
    }
    const t0 = clock();
    const duration = opts.durationMs ?? 480;
    const step = () => {
      if (!on) return;
      const u = Math.min(1, (clock() - t0) / duration);
      const e = u * u * (3 - 2 * u);
      host.write({
        ...from,
        position: from.position.map((v, i) => v + (to.position[i] - v) * e),
        target: to.target.slice(),
        controlsEnabled: false,
        mode: from.mode ?? null,
      });
      if (u < 1) anim = opts.requestFrame(step);
      else anim = 0;
    };
    anim = opts.requestFrame(step);
  }

  function enter() {
    if (on) return false;
    const camera = host.read();
    snapshot = { camera, clutter: host.clutterState?.() ?? null };
    on = true;
    host.setClutter?.(true);
    button?.setAttribute?.('aria-pressed', 'true');
    applyPose(camera, cinematicPose(camera));
    opts.onChange?.(true);
    return true;
  }

  function exit() {
    if (!on || !snapshot) return false;
    cancelAnim();
    host.write(snapshot.camera);
    if (snapshot.clutter != null && host.restoreClutter) host.restoreClutter(snapshot.clutter);
    else host.setClutter?.(false);
    on = false;
    snapshot = null;
    button?.setAttribute?.('aria-pressed', 'false');
    opts.onChange?.(false);
    return true;
  }

  function onKey(e) {
    if (!e || e.repeat) return;
    if (typingTarget(e, doc)) return;
    if (e.key === 'F1') {
      if (!claimKey || e.defaultPrevented) return;
      e.preventDefault?.();
      on ? exit() : enter();
    } else if (e.key === 'Escape' && on) {
      e.preventDefault?.();
      e.stopPropagation?.();
      exit();
    }
  }

  function onClick() { on ? exit() : enter(); }
  win.addEventListener?.('keydown', onKey);
  button?.addEventListener?.('click', onClick);

  return {
    enter, exit,
    toggle() { return on ? exit() : enter(); },
    isOn: () => on,
    destroy() {
      win.removeEventListener?.('keydown', onKey);
      button?.removeEventListener?.('click', onClick);
      if (on) exit();
    },
  };
}

export function tryGameAdapter(gx, g) {
  if (typeof gx?.camMode !== 'function' || !g?.cam?.position || !g?.ctl?.target) {
    return { available: false, reason: 'GX.camMode and G.cam / G.ctl were not found. Live rig wiring is pending.', contract: CAMERA_CONTRACT };
  }
  const host = {
    read() {
      const p = g.cam.position;
      const t = g.ctl.target;
      return {
        position: [p.x, p.y, p.z],
        target: [t.x, t.y, t.z],
        controlsEnabled: g.ctl.enabled !== false,
        mode: null,
      };
    },
    write(s) {
      g.cam.position.set?.(s.position[0], s.position[1], s.position[2]);
      g.ctl.target.set?.(s.target[0], s.target[1], s.target[2]);
      if (typeof s.controlsEnabled === 'boolean') g.ctl.enabled = s.controlsEnabled;
      g.ctl.update?.();
    },
    setClutter(hide) { g.root?.classList?.toggle?.('rtoc-cinematic', !!hide); },
  };
  return { available: true, host, contract: CAMERA_CONTRACT };
}
