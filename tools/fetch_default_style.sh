#!/usr/bin/env bash
#
# fetch_default_style.sh
#
# Pulls the "default" town style PNGs from the boona13/mykonos-island-voxels
# repo into assets/default/ so the Default style renders with real images.
#
# Run this from the project root (the folder containing index.html) on a
# machine that can reach GitHub:
#
#     bash tools/fetch_default_style.sh
#
# It does a shallow sparse clone of just the source repo's assets/ folder,
# copies the root PNGs (+ the one raw/ file we need) into assets/default/,
# then cleans up the temp clone.

set -euo pipefail

REPO="https://github.com/boona13/mykonos-island-voxels.git"
DEST="assets/default"
TMP="$(mktemp -d)"

echo "→ Cloning asset pack from $REPO (shallow)…"
git clone --depth 1 --filter=blob:none --sparse "$REPO" "$TMP/src"
( cd "$TMP/src" && git sparse-checkout set assets )

mkdir -p "$DEST"

echo "→ Copying root PNGs into $DEST/ …"
cp "$TMP"/src/assets/*.png "$DEST"/ 2>/dev/null || true

# wood_pile only exists under assets/raw/ in the source repo; our default
# manifest points wood_pile at raw/wood_pile.png, so preserve that path.
mkdir -p "$DEST/raw"
cp "$TMP"/src/assets/raw/wood_pile.png "$DEST/raw/" 2>/dev/null || true

# The source repo keeps Crop Patch / Garden Bed / Veg Garden under newAsset/
# with capitalised names. Our default manifest uses the flat lowercase
# crop_patch.png / garden_bed.png / veg_garden.png from the root, which the
# loop above already copied — nothing more to do.

echo "→ Cleaning up…"
rm -rf "$TMP"

echo "✓ Done. Copied $(ls "$DEST"/*.png 2>/dev/null | wc -l) PNGs into $DEST/."
echo "  Reload the app and pick the \"Default\" style in the Dream Panel."
