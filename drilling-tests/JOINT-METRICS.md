# BHE and joint-length comparison

BHE is block position, potentially with a negative datum offset. It is not pipe
length. The previous UI labelled the MD interval between detected BHE resets as
measured block travel, and after five intervals silently replaced the 13 m target
with that median MD interval. This conflated three different quantities.

The dashboard now shows:
- Drilled MD since the last detected connection, against actual tally joint length
  when a current tally joint is identified, otherwise 13 m explicitly nominal.
- Observed MD spacing between detected connections, labelled as connection spacing.
- Observed BHE travel within the current detected cycle (maximum minus minimum).

For example, BHE 12.9 to 8.9 m is 4 m travel; the instantaneous 8.9 m position is
not the length of the joint. BHE -0.1 to 12.9 m is a 13 m stroke despite the offset.
BHE in feet/cm/mm is normalized to metres before the block-jump detector. Missing
units do not silently enter a detector expecting metres. Missing/sentinel values
are excluded. A likely missed connection is flagged if drilled distance exceeds
the target; source values are not rescaled to force agreement.

The connection detector remains heuristic and depth-sampled. Pick-ups, reaming,
short joints, missing rows, mechanical offsets and missed resets can affect MD
spacing. This is not a certified pipe-length measurement. A tally remains the
source for actual physical pipe lengths. No actual WITSML values are overwritten.

Five focused regression tests plus existing tests pass (28 total). Actual Ops
rendering at 1920x1080 and 390x844 confirms that repeated 12.3 m connection spacing
does not change a 13 m nominal denominator, and a current 4 m BHE stroke and drilled
MD are labelled independently. Browser transport uses local fixtures; production
uses its existing WITSML connection. No additional network reads are introduced.
