#!/usr/bin/env bash
# Rebuild all showroom rig GLBs (3 LODs each) headless. Blender 4.2 LTS (official tarball, free).
# BLENDER=/path/to/blender bash tools/blender/build.sh [rig ...]
set -euo pipefail
cd "$(dirname "$0")"
B=${BLENDER:-$(command -v blender || echo /workspace/blender-4.2.3-linux-x64/blender)}
OUT=../../assets/rigs
RIGS=${*:-single triple heli workover ctu jackup semi ship frac}
mkdir -p "$OUT"
for r in $RIGS; do for l in 0 1 2; do
  n=$(echo low med high | cut -d' ' -f$((l+1)))
  "$B" -b --factory-startup --python build.py -- "$r" "$l" "$OUT/${r}_${n}.glb" 2>&1 | grep -E "BUILT|Error|Traceback|failed" || true
done; done
ls -la "$OUT"
