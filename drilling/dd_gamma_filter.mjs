// Scalar random walk in sensor measured depth. All settings are synthetic training assumptions.
export const SETTINGS = Object.freeze({
  spacingM: 1, setbackM: 6, referenceRopMph: 12, gammaSd: 7, floorSd: 3,
  processVariancePerM: 5, contrastScale: 0.18, contrastVariance: 240,
  slideVarianceFactor: 2, spikeSigma: 3.5, maxAgeSec: 120
});

const finite = Number.isFinite;
const positive = x => finite(x) && x > 0;

export function gammaVariance(ropMph, mode, cfg = SETTINGS) {
  // Relative count exposure for a fixed spatial gate is inversely proportional to ROP.
  return cfg.floorSd ** 2 + cfg.gammaSd ** 2 * ropMph / cfg.referenceRopMph *
    (mode === 'slide' ? cfg.slideVarianceFactor : 1);
}

export function mechanicalIndex(m) {
  if (!m || !['rotate', 'slide'].includes(m.mode) ||
      ![m.formationRop, m.referenceRop, m.wob, m.bitRpm, m.flow].every(positive)) return null;
  return Math.log(m.formationRop / m.referenceRop);
}

export class GammaFilter {
  constructor(cfg = SETTINGS) {
    this.cfg = cfg;
    this.md = this.time = this.mean = this.variance = this.previous = this.suspect = null;
  }

  observe(packet, nowSec) {
    const {sensorMd, bitMd, atSec, gamma, mechanics, mode, rop} = packet;
    const cfg = this.cfg;
    const result = (status, updated = false) => ({
      packet, status, updated, md: this.md, mean: this.mean,
      half95: this.variance === null ? null : 1.96 * Math.sqrt(this.variance)
    });
    if (![sensorMd, bitMd, atSec, nowSec].every(finite) || sensorMd < 0 ||
        atSec < 0 || nowSec < atSec || Math.abs(bitMd - cfg.setbackM - sensorMd) > 1e-5)
      return result('Invalid sensor depth or time');
    if (nowSec - atSec > cfg.maxAgeSec) return result('Stale arrival');
    if (this.md !== null) {
      if (sensorMd === this.md && atSec === this.time) return result('Duplicate station');
      if (sensorMd <= this.md || atSec <= this.time) return result('Reordered or repeated MD');
    }

    const gap = this.md === null ? 0 : sensorMd - this.md;
    const activity = packet.connection ? 'Connection · held' : packet.onBottom === false ? 'Off bottom · held' :
      packet.stalled ? 'Motor stall · held' : null;
    const index = activity ? null : mechanicalIndex(mechanics);
    const comparable = this.previous && index !== null && mechanics.mode === this.previous.mode &&
      gap <= cfg.spacingM * 1.01;
    const contrast = comparable ? Math.min(1, Math.abs(index - this.previous.index) / cfg.contrastScale) : 0;
    this.previous = index === null ? null : {mode: mechanics.mode, index};
    if (this.variance !== null)
      this.variance += cfg.processVariancePerM * gap + cfg.contrastVariance * contrast ** 2;
    this.md = sensorMd;
    this.time = atSec;

    const skip = activity || (!['rotate', 'slide'].includes(mode) ? 'Incompatible drilling mode' :
      !positive(rop) ? 'Invalid acquisition ROP' : gamma == null ? 'Gamma missing' :
      !finite(gamma) || gamma < 0 ? 'Invalid gamma' : null);
    if (skip) {
      this.suspect = null;
      return result(skip);
    }
    const noise = gammaVariance(rop, mode, cfg);
    if (this.mean === null) {
      this.mean = gamma;
      this.variance = noise;
      return result('First gamma', true);
    }
    const residual = gamma - this.mean;
    if (Math.abs(residual) > cfg.spikeSigma * Math.sqrt(this.variance + noise)) {
      // A single spike cannot move the mean. Confirm a step with an independent adjacent bin.
      const confirmed = this.suspect && gap <= cfg.spacingM * 1.01 &&
        Math.sign(residual) === Math.sign(this.suspect.value - this.mean) &&
        Math.abs(gamma - this.suspect.value) <= 2.5 * Math.sqrt(noise + this.suspect.noise);
      if (!confirmed) {
        this.suspect = {value: gamma, noise};
        return result('Gamma outlier held');
      }
      this.mean = gamma;
      this.variance = noise;
      this.suspect = null;
      return result('Gamma step confirmed', true);
    }
    this.suspect = null;
    const gain = this.variance / (this.variance + noise);
    this.mean += gain * residual;
    this.variance *= 1 - gain;
    return result(comparable ? 'Gamma + drilling response' : 'Gamma · mechanical comparison unavailable', true);
  }
}
