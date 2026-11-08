// Pressure bookkeeping shared by the integrated drilling-game pressure view.
// Friction is supplied by fluids.js; this module adds no second correlation.
export const ATM_PA = 101325;
export const G_M_S2 = 9.80665;
const finiteNonNegative = (name, value) => {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and >= 0`);
  return value;
};

export function uTubeBalance({tvdM, stringDensityKgM3, annulusDensityKgM3,
  stringBoundaryAbsPa = ATM_PA, annulusBoundaryAbsPa = ATM_PA}) {
  for (const [name, value] of Object.entries({tvdM, stringDensityKgM3, annulusDensityKgM3,
    stringBoundaryAbsPa, annulusBoundaryAbsPa})) finiteNonNegative(name, value);
  const stringBottomAbsPa = stringBoundaryAbsPa + stringDensityKgM3 * G_M_S2 * tvdM;
  const annulusBottomAbsPa = annulusBoundaryAbsPa + annulusDensityKgM3 * G_M_S2 * tvdM;
  const imbalancePa = stringBottomAbsPa - annulusBottomAbsPa;
  return {stringBottomAbsPa, annulusBottomAbsPa, imbalancePa, balanced: Math.abs(imbalancePa) < 1,
    requiredStringBoundaryAbsPa: annulusBottomAbsPa - stringDensityKgM3 * G_M_S2 * tvdM,
    requiredAnnulusBoundaryAbsPa: stringBottomAbsPa - annulusDensityKgM3 * G_M_S2 * tvdM};
}

/** Depth is true vertical depth in metres. Losses are cumulative pressure drops (Pa)
 * from fluids.js; callbacks return cumulative losses at the requested depth. */
export function uTubeProfile({tvdM, depthsM, densityKgM3, returnBoundaryAbsPa = ATM_PA,
  appliedSurfacePa = 0, surfaceLossPa = 0, stringLossPa = 0, annulusLossPa = 0,
  bitLossPa = 0, motorLossPa = 0, mwdLossPa = 0,
  hydrostaticAt = z => densityKgM3 * G_M_S2 * z,
  stringHydrostaticAt = hydrostaticAt, annulusHydrostaticAt = hydrostaticAt,
  stringLossAt = z => tvdM > 0 ? stringLossPa * z / tvdM : 0,
  annulusLossAt = z => tvdM > 0 ? annulusLossPa * z / tvdM : 0}) {
  for (const [name, value] of Object.entries({tvdM, densityKgM3, returnBoundaryAbsPa,
    appliedSurfacePa, surfaceLossPa, stringLossPa, annulusLossPa, bitLossPa, motorLossPa, mwdLossPa})) finiteNonNegative(name, value);
  const downholeLoss = stringLossPa + annulusLossPa + bitLossPa + motorLossPa + mwdLossPa;
  const totalLoopLoss = surfaceLossPa + downholeLoss;
  const annulusSurfaceAbsPa = returnBoundaryAbsPa + appliedSurfacePa;
  const annulusHead = Math.max(0,annulusHydrostaticAt(tvdM));
  const stringHead = Math.max(0,stringHydrostaticAt(tvdM));
  const pumpDischargeAbsPa = annulusSurfaceAbsPa + totalLoopLoss + annulusHead - stringHead;
  const rows = depthsM.map(depthM => {
    finiteNonNegative('depthM', depthM);
    const z = Math.min(tvdM, depthM), hydroPa = Math.max(0,annulusHydrostaticAt(z));
    const strFriction = Math.min(stringLossPa, Math.max(0, stringLossAt(z)));
    const annFriction = Math.min(annulusLossPa, Math.max(0, annulusLossAt(z)));
    const stringAbsPa = pumpDischargeAbsPa - surfaceLossPa - strFriction + Math.max(0,stringHydrostaticAt(z));
    const annulusAbsPa = returnBoundaryAbsPa + appliedSurfacePa + annFriction + hydroPa;
    return {depthM:z, hydrostaticPa:hydroPa, stringFrictionPa:strFriction, annulusFrictionPa:annFriction,
      stringAbsPa, annulusAbsPa, stringGaugePa:stringAbsPa-ATM_PA, annulusGaugePa:annulusAbsPa-ATM_PA};
  });
  const bottomHoleOuterAbsPa = annulusSurfaceAbsPa + annulusHead + annulusLossPa;
  const bottomHoleInnerAbsPa = bottomHoleOuterAbsPa + bitLossPa;
  return {returnBoundaryAbsPa, annulusSurfaceAbsPa, pumpDischargeAbsPa,
    pumpDischargeGaugePa:pumpDischargeAbsPa-ATM_PA, bottomHoleInnerAbsPa, bottomHoleOuterAbsPa,
    bottomBhaInletAbsPa:bottomHoleInnerAbsPa+motorLossPa+mwdLossPa, bitAcrossPa:bitLossPa,
    totalLoopLossPa:totalLoopLoss, rows};
}

export function annularCapacityM3(segments) {
  return segments.reduce((sum, s) => {
    for (const [n,v] of Object.entries({fromM:s.fromM,toM:s.toM,holeDiameterM:s.holeDiameterM,pipeOutsideDiameterM:s.pipeOutsideDiameterM})) finiteNonNegative(n,v);
    if (s.toM < s.fromM || s.holeDiameterM < s.pipeOutsideDiameterM) throw new RangeError('invalid annular geometry');
    return sum + Math.PI / 4 * (s.holeDiameterM ** 2 - s.pipeOutsideDiameterM ** 2) * (s.toM - s.fromM);
  }, 0);
}
