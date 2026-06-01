/**
 * assetManifest.js  (runtime, style-aware)
 *
 * Historically this file hardcoded the single Mykonos asset list. It is now
 * a *live* runtime manifest: the array + index are populated from whichever
 * style pack is currently active (see styleRegistry.js + builtinMykonos.js).
 *
 * The exported bindings ASSET_MANIFEST / ASSET_INDEX / CATEGORIES keep the
 * SAME object identity across style switches — their *contents* are replaced
 * in place via setActiveManifest(). This means every module that did
 * `import { ASSET_MANIFEST } from './assetManifest.js'` keeps working with no
 * changes; after a style switch they simply see the new entries.
 *
 * Each entry binds (unchanged from before):
 *   id, name, category, footprint {w,d}, kind, filename, sizeScale,
 *   plus optional noShadow / fitCell / flatBase / shadowStyle / tileLike /
 *   buildStage / builder.
 *
 * `assetBaseDir` (e.g. 'assets/' or 'assets/santorini/') tells the loader
 * where to resolve `filename`. It is exposed via getAssetBaseDir().
 */

import { BUILTIN_STYLE } from './builtinMykonos.js';

// Live, mutated-in-place. Do NOT reassign these bindings — mutate contents.
export const ASSET_MANIFEST = [];
export const ASSET_INDEX = {};
export const CATEGORIES = ['terrain', 'nature', 'props', 'water', 'buildings'];

let _baseDir = 'assets/';
let _activeStyleId = BUILTIN_STYLE.id;

/**
 * Replace the live manifest contents with a new style's asset list.
 *
 * @param {object} manifest  { id, name, assets[], assetBaseDir }
 */
export function setActiveManifest(manifest) {
    ASSET_MANIFEST.length = 0;
    for (const a of manifest.assets) ASSET_MANIFEST.push(a);

    for (const k of Object.keys(ASSET_INDEX)) delete ASSET_INDEX[k];
    for (const a of ASSET_MANIFEST) ASSET_INDEX[a.id] = a;

    _baseDir = manifest.assetBaseDir ?? 'assets/';
    _activeStyleId = manifest.id ?? _activeStyleId;
}

export function getAssetBaseDir() {
    return _baseDir;
}

export function getActiveManifestStyleId() {
    return _activeStyleId;
}

// Seed with the built-in Mykonos pack so anything that reads the manifest
// before the first explicit style load still sees a valid set.
setActiveManifest({
    id: BUILTIN_STYLE.id,
    name: BUILTIN_STYLE.name,
    assets: BUILTIN_STYLE.assets,
    assetBaseDir: 'assets/flower/',
});
