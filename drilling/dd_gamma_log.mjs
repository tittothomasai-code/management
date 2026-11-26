import {GammaFilter, gammaVariance, SETTINGS} from './dd_gamma_filter.mjs';
import {mulberry, ropOf} from './ddcab_core.js?v=b11';

function normal(random) {
  return Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, random()))) * Math.cos(2 * Math.PI * random());
}

// Operates on the DD exercise's drilled segments only. No commanded or live well path.
export class TrainingGammaLog {
  constructor(originMd, seed, cfg = SETTINGS) {
    if (!(cfg.spacingM > 0 && cfg.setbackM >= 0 && Number.isInteger(cfg.setbackM / cfg.spacingM)))
      throw new RangeError('Setback must span whole logging stations');
    this.cfg = cfg;
    this.originMd = this.lastBitMd = originMd;
    this.station = 1;
    this.history = new Map();
    this.filter = new GammaFilter(cfg);
    this.random = mulberry((seed ^ 0x7191ef) >>> 0);
    this.seconds = 0;
    this.binMode = null;
    this.status = 'Waiting for sensor coverage';
    this.latest = null;
    this.trace = [];
  }

  hold(reason) {
    this.binMode = 'mixed';
    this.status = reason;
    this.filter.previous = this.filter.suspect = null;
  }

  advance(a, b, clockHours, rig, strat) {
    if (this.failed) return;
    try {
      this.sampleSegment(a, b, clockHours, rig, strat);
    } catch (error) {
      // The optional log must never interrupt the drill loop, including a failed geology lookup.
      this.failed = true;
      this.hold('Synthetic instrument unavailable · reset to restart');
      console.warn('DD gamma instrument stopped', error);
    }
  }

  sampleSegment(a, b, clockHours, rig, strat) {
    const {spacingM, setbackM} = this.cfg;
    const length = b.md - a.md;
    if (!(length > 0 && Number.isFinite(length) && Number.isFinite(rig.rop) && rig.rop > 0)) {
      this.hold('Invalid drilled interval');
      return;
    }
    if (a.md < this.lastBitMd - 1e-7) {
      this.status = 'Repeated or reordered drilled interval';
      return;
    }
    if (a.md > this.lastBitMd + 1e-7) {
      this.originMd = a.md;
      this.history.clear();
      this.trace.length = 0;
      this.station = 1;
      this.seconds = 0;
      this.binMode = this.latest = null;
      this.filter = new GammaFilter(this.cfg);
      this.status = 'Missing drilled interval · waiting for new sensor coverage';
    }
    this.lastBitMd = b.md;
    // Restrict generator to the built-in SIM earth model. No mutable selected model or feed.
    if (!this.earth && strat) this.earth = strat.SIM_STRAT();
    let cursor = a.md;
    const observeMode = () => {
      if (this.binMode === null) this.binMode = rig.mode;
      if (this.binMode !== rig.mode) this.binMode = 'mixed';
    };
    while (this.originMd + this.station * spacingM <= b.md + 1e-9) {
      observeMode();
      const bitMd = this.originMd + this.station * spacingM;
      this.seconds += Math.max(0, bitMd - cursor) / rig.rop * 3600;
      const share = Math.max(0, Math.min(1, (bitMd - a.md) / length));
      const at = key => a[key] + (b[key] - a[key]) * share;
      const point = {tvd: at('tvd'), E: at('E'), N: at('N')};
      const validPoint = Object.values(point).every(Number.isFinite);
      const bed = validPoint && this.earth && strat?.lithAt(this.earth, point.tvd, point.E, point.N);
      const referenceRop = rig.rop;
      const formationRop = bed ? ropOf({bitRpm: rig.bitRpm}, {
        wob: rig.wob, rotating: rig.mode === 'rotate', lithRop: strat.response(bed.lith).rop
      }) * (1 + 0.02 * normal(this.random)) : null;
      this.history.set(this.station, {point, validPoint, mode: this.binMode, wob: rig.wob, flow: rig.flow,
        bitRpm: rig.bitRpm, referenceRop, formationRop});
      const sourceStation = this.station - setbackM / spacingM;
      const mechanics = this.history.get(sourceStation);
      if (mechanics) {
        const p = mechanics.point;
        const level = mechanics.validPoint && this.earth && strat ?
          strat.gammaAt(this.earth, p.tvd, p.E, p.N) : null;
        const rop = 3600 * spacingM / this.seconds;
        const gamma = Number.isFinite(level) ? Math.max(0, level +
          normal(this.random) * Math.sqrt(gammaVariance(rop, this.binMode, this.cfg))) : null;
        const atSec = clockHours * 3600 + (bitMd - a.md) / rig.rop * 3600;
        const packet = {atSec, sensorMd: this.originMd + sourceStation * spacingM, bitMd,
          gamma, mechanics, rop, mode: this.binMode};
        this.latest = this.filter.observe(packet, atSec);
        this.status = this.latest.status;
        this.trace.push(this.latest);
        if (this.trace.length > 60) this.trace.shift();
        this.history.delete(sourceStation);
      }
      this.station++;
      cursor = bitMd;
      this.seconds = 0;
      this.binMode = null;
    }
    if (b.md > cursor + 1e-9) {
      observeMode();
      this.seconds += (b.md - cursor) / rig.rop * 3600;
    }
  }
}
