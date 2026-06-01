#!/usr/bin/env bash
#
# cleanup_assets.sh
#
# One-time tidy-up after the assets/ reorganisation into per-style folders.
#
# The new layout is:
#   assets/
#   ├── styles.json
#   ├── flower/   (built-in style PNGs + newAsset/)
#   └── default/  (default style PNGs + raw/wood_pile.png)
#   asset-sources/   (raw originals — outside the runtime assets/ tree)
#
# The reorg already COPIED everything into its new home. This script removes
# the leftover originals that were copied out of assets/:
#   - assets/newAsset/      (now assets/flower/newAsset/)
#   - assets/raw/           (now asset-sources/raw/)
#   - assets/raw_pending/   (now asset-sources/raw_pending/)
#   - any loose assets/*.png at the root (now assets/flower/*.png)
#
# Safe to run more than once. Run from the project root:
#     bash tools/cleanup_assets.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo "Verifying new layout before deleting anything…"
test -f assets/flower/manifest.json   && echo "  ✓ assets/flower/ exists"  || { echo "  ✗ assets/flower missing — aborting"; exit 1; }
test -f assets/default/manifest.json  && echo "  ✓ assets/default/ exists" || { echo "  ✗ assets/default missing — aborting"; exit 1; }
[ -d assets/flower/newAsset ] && echo "  ✓ assets/flower/newAsset/ exists" || echo "  • (flower/newAsset not present — ok if this style has none)"

echo
echo "Removing leftover originals from assets/ …"
rm -rf assets/raw assets/raw_pending assets/newAsset
# Any loose PNGs left at the assets/ root belong to the old flat layout.
find assets -maxdepth 1 -name '*.png' -delete 2>/dev/null || true

echo
echo "Final assets/ tree:"
ls -1 assets/
echo
echo "✓ Cleanup done. assets/ now holds only styles.json + per-style folders."
echo "  Raw source art lives in asset-sources/ (kept out of the runtime tree)."
