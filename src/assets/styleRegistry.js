/**
 * styleRegistry.js
 *
 * Discovers and tracks the available town styles. A "style pack" is a folder
 * under /assets/<id>/ containing a manifest.json plus the PNG assets, as
 * described in STYLE_PACK_SPEC.md.
 *
 * The registry reads /assets/styles.json for the master list. If that file
 * is missing (e.g. early dev, before Codex ships any packs), it falls back
 * to a single built-in "mykonos" style backed by the bundled manifest +
 * procedural builders, so the editor always works.
 */

import { BUILTIN_STYLE } from './builtinMykonos.js';

const STYLES_INDEX_URL = 'assets/styles.json';

let _styles = null;       // [{ id, name, thumbnail }]
let _activeId = null;

/** The id used when nothing else is selected / no styles.json present. */
export const DEFAULT_STYLE_ID = 'flower';

/**
 * Legacy id aliases. The built-in pack used to be called "mykonos"; saves and
 * autosaves from that era carry style:"mykonos". Map them onto the current id
 * so old saves keep working.
 */
const STYLE_ALIASES = { mykonos: 'flower' };

/** Resolve a possibly-legacy style id to its current id. */
export function resolveStyleId(id) {
    return STYLE_ALIASES[id] ?? id;
}

/**
 * Load the master style list. Tolerant of a missing styles.json: in that
 * case we expose just the built-in style so the app boots.
 */
export async function loadStyleList() {
    if (_styles) return _styles;
    try {
        const res = await fetch(STYLES_INDEX_URL, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`styles.json ${res.status}`);
        const list = await res.json();
        if (Array.isArray(list) && list.length) {
            _styles = list.map(s => ({
                id: s.id,
                name: s.name ?? s.id,
                thumbnail: s.thumbnail ?? `${s.id}/thumbnail.png`,
            }));
        } else {
            throw new Error('styles.json empty');
        }
    } catch (e) {
        console.info('[styles] no styles.json; using built-in flower pack only.');
        _styles = [{
            id: BUILTIN_STYLE.id,
            name: BUILTIN_STYLE.name,
            thumbnail: null,
        }];
    }
    return _styles;
}

export function getStyleList() {
    return _styles ?? [];
}

export function getActiveStyleId() {
    return _activeId ?? DEFAULT_STYLE_ID;
}

export function setActiveStyleId(id) {
    _activeId = id;
}

/**
 * Fetch and normalise a style's manifest into the in-memory shape the rest
 * of the code expects (the same shape the legacy hardcoded manifest used).
 *
 * For the built-in mykonos id we return the bundled manifest (with its
 * procedural builders) directly, without a network round-trip.
 */
export async function loadStyleManifest(styleId) {
    styleId = resolveStyleId(styleId);
    if (styleId === BUILTIN_STYLE.id) {
        // Built-in flower pack: PNGs live in assets/flower/, with procedural
        // builders as a fallback for any missing image.
        return {
            id: BUILTIN_STYLE.id,
            name: BUILTIN_STYLE.name,
            assets: BUILTIN_STYLE.assets,
            assetBaseDir: 'assets/flower/',
        };
    }

    const base = `assets/${styleId}/`;
    const res = await fetch(`${base}manifest.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`manifest.json for "${styleId}" ${res.status}`);
    const manifest = await res.json();

    const assets = (manifest.assets ?? []).map(a => ({
        id: a.id,
        name: a.name ?? a.id,
        category: a.category,
        kind: a.kind ?? (a.category === 'terrain' ? 'terrain' : 'object'),
        footprint: a.footprint ?? { w: 1, d: 1 },
        filename: a.filename ?? `${a.id}.png`,
        sizeScale: a.sizeScale ?? 1,
        tileLike: a.tileLike === true,
        noShadow: a.noShadow === true,
        flatBase: a.flatBase === true,
        fitCell: a.fitCell === true,
        shadowStyle: a.shadowStyle ?? 'cast',
        buildStage: a.buildStage ?? null,
        // No procedural builder for external packs.
    }));

    return {
        id: manifest.id ?? styleId,
        name: manifest.name ?? styleId,
        assets,
        assetBaseDir: base,
    };
}
