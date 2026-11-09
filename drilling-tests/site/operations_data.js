// Adversarial harness adapter. The CTO script does not thread an observation
// object and treats lastRowMs as a receipt clock. The dashboard classifier
// remains the one in drilling/operations_data.js.
import {feedSource as core} from '../../drilling/operations_data.js';

const observation = {};
const identity = {w:'W', b:'B', uid:'U'};

function label(status) {
  return status === 'WITSML WAITING FOR ADVANCE' ? 'WITSML SNAPSHOT' : status;
}

export function feedSource(w, now, cfg) {
  if (!w) return label(core(w, now, cfg, observation));
  if (w.log && !w.log.w) Object.assign(w.log, identity);
  const stamp = w.hist?.at?.(-1)?.t;
  const aligned = Number.isFinite(stamp) ? {...w, lastRowMs:stamp} : w;
  return label(core(aligned, now, cfg, observation));
}
