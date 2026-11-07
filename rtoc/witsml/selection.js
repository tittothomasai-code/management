// Joint navigation. A historical selection is a deep copy and does not follow later live appends.

export function liveJoint(joints) {
  if (!joints?.length) return null;
  return joints.find(j => j.open) || joints[joints.length - 1];
}

export function initSelection() {
  return { mode: 'live', frozen: null };
}

export function shownJoint(state, joints) {
  if (state?.mode === 'historical') return state.frozen || null;
  return liveJoint(joints);
}

export function goLive() {
  return { mode: 'live', frozen: null };
}

export function goHistorical(joint) {
  if (!joint) return initSelection();
  return { mode: 'historical', frozen: structuredClone(joint) };
}

export function step(state, joints, dir) {
  const cur = shownJoint(state, joints);
  const i = joints.findIndex(j => j && cur && j.id === cur.id);
  if (i < 0) return state || initSelection();
  const n = joints[i + dir];
  if (!n) return state;
  return goHistorical(n);
}
