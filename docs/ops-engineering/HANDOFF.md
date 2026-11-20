# Operations engineering models

Operations has an **Engineering** button beside the existing Performance and Well
Folder views. The dialog has Hydraulics, Torque & drag, and System energy tabs.
Model forms are in **Model inputs & settings**. Existing source data remains read-only.
No account, permission, billing, document, WITSML or rig-control API is changed.

## Inputs and use

1. Select the actual wellbore in Ops. Open Engineering and review the source label.
2. Download its input template or use the forms. Enter the deployed string from
   surface to bit, hole/casing geometry, actual survey coverage, depth datum, mud,
   characterized pressure losses and reviewed friction factors. State the source.
3. Enter the surface/tie-in TVD in the same datum as bit TVD. A TVDSS offset must not
   become extra hydrostatic head. Missing datum tie-in leaves pressure/ECD unknown.
4. Apply reviewed inputs. No planned BHA, nominal joint length, default mud or inferred
   flow silently becomes an actual input. Actual bit MD must agree with deployed
   geometry within 0.25 m, or select an explicit entered scenario.
5. Use the energy inventory editor for actual assets. Export the input model and
   calculation before closing the tab. Input state stays in the current tab and exact
   well/bore/source session. After another login a saved model needs explicit source
   review to rebind; different well/bore UIDs are refused. The export records that review.

The Well Folder holds source programs and later as-run BHA, tally, mud and equipment
records. It is the document store. This module does not make a second private store.
Source programs alone do not establish the actual deployed string or current rheology.

## Hydraulics

Validated SI geometry is segmented at string, hole, tool and survey boundaries.
Newtonian laminar pipe loss uses Hagen–Poiseuille; concentric annulus loss uses the
exact laminar annular expression. Turbulent Newtonian loss uses Darcy/Swamee–Jain
with a documented transition blend. The existing `fluids.js` Herschel–Bulkley/Fann
kernel is reused for non-Newtonian loss. Its smooth-conduit approximation rejects
nonzero roughness rather than ignoring it. All supplied Fann inputs must be valid.

Results separate string, annulus, bit/nozzles, tools, characterized surface loss and
return backpressure. SPP, nozzle hydraulic power, bottomhole gauge pressure, bit/shoe
ECD and segment profiles retain units. Tool/surface losses require a reference flow
and a reviewed exponent, or a fixed-flow characterization. Pressure alone supplies
no quantitative flow. Optional pumps-off surge/swab is an equivalent-flow steady
screening with entered end condition, clinging fraction and gel break stress.
Pressure-window checks require a matching datum and bit depth.

## Torque and drag

The module calls the existing `wpg_core.js` soft-string kernel with additive options:
exact breakpoints, minimum-curvature survey interpolation, per-component buoyancy,
section friction and a coupled rotation/axial-speed friction split. Existing callers
keep their prior defaults. Seven cases cover pickup, slack-off, rotate off-bottom,
rotary drilling, sliding and rotating trips in/out. Profiles retain tension, torque,
normal force and sinusoidal/helical buckling screening. Strength margins appear only
when actual component ratings are supplied. Missing parent-hole surveys are refused;
no vertical extension is invented. Model cases do not establish measured sliding.
The existing Performance view continues to identify actual sliding intervals.

## Power, energy and system boundary

Power is W; integrated work is J/kWh; stored energy is J/MJ. Do not combine them.
Measured pump power is Q × SPP, surface rotary power is torque × angular velocity,
and hoist transfer is signed force × speed only after direction/reference/tare review.
The selected operating row comes from one log. Channels are never joined across
unverified time and depth logs. Negative/unreviewed hookload and BHE yield no hoist
power. SPP >100 psi remains only a qualitative pump-on clue when flow is absent.

Energy is integrated from actual time-log rows with per-channel coverage. Depth-indexed
rows cannot prove duration. Duplicate/reversed times, missing channels and gaps over
60 seconds break integration. No missing channel becomes zero. Live requires an
observed advancing, fresh time index; connector heartbeat alone does not prove Live.

Inventory types are fuel LHV, usable battery SOC, compressed liquid, ideal-isothermal
gas work above ambient, rotational/translational kinetic, suspended potential and
thermal reference content. IDs must be unique. Deployed-string elastic energy uses
axial/pressure normal stresses and torsion; liquid compression uses the actual
modeled pressure distribution. Do not list those terms again as inventory assets.
Input pump power and downstream fluid transfer are not added twice. A whole-system
stored total is withheld unless the stated inventory boundary is explicitly complete
and both inventory and string/fluid calculations are available. Otherwise show a
partial known sum and the missing inputs. No real rig energy total has been verified.

## Limits

These are single-phase, quasi-steady hydraulics and soft-string load models. They
are not multiphase CFD, stiff-string or transient waterhammer models. Eccentricity,
cuttings beds, gas, vibration, fatigue and full tool/rig efficiency require additional
validated inputs/models. Survey and depth reference uncertainty remains material.
No green operational approval, rig actuation or automatic equipment setting exists.
Worker execution keeps calculations off the UI and refuses stale-context results.
Large profiles are fully exported even when the screen shows only 100 rows.

## Validation and release

- 177 full drilling unit tests passed, including 27 new engineering kernel tests.
  Covers analytic Newtonian limits, annular loss, HB refusal/validation, energy units,
  missing samples, SI conversion, geometry and TVD-datum invariance, seven load cases,
  source isolation, inventory uniqueness and explicit model rebinding.
- Synthetic real Ops/UI/worker browser flow passed at 1920×1080 and 390×844. Covers
  template/model import, manual forms, inventory, reports/profiles, live/stale source
  semantics, wrong well/bore denial, source review, phone layout, Escape and Q.
- 30 legacy T&D/buckling parameter combinations matched the published kernel exactly.
  Performance and landing browser regressions passed at both screen sizes.
- No real well data, user documents, live connection or credentials are fixtures.
  Screenshots in this folder are synthetic. Generated artifacts stay out of source.
- The existing release workflow preserves the complete published static inventory,
  verifies an unpublished candidate and its synthetic engineering flow, then publishes
  only that tested candidate. Actual production verification is recorded by the workflow.
- No migration is needed. Rollback republishes the preflight `rollbackDeploy.id` from
  release evidence. Before this release the Ops baseline is `6b00774f9801b71a2b02a2ab`.
  Restoring static assets does not alter well files, approvals, permissions or feed data.
