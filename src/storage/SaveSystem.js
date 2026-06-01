/**
 * SaveSystem.js
 *
 * Persistence using localStorage.
 *
 * Two layers:
 *   1. Autosave (single slot, key CONFIG.storageKey) — the working session,
 *      restored automatically on next visit. Now also remembers the active
 *      style id and (optionally) the build-order timeline.
 *   2. Named "dream town" saves (key `${storageKey}.towns`) — a small library
 *      the user explicitly saves into, plus JSON import/export. Each town is
 *      a self-contained combo of { style, tileMap, buildOrder, camera } —
 *      this is the format the sponsorship platform will consume later.
 *
 * The autosave schema is bumped to v2 (adds `style` + `buildOrder`). v1 saves
 * still load: the loader tolerates missing fields.
 */

import { CONFIG } from '../config.js';
import { PlacedObject } from '../building/PlacedObject.js';

const KEY = CONFIG.storageKey;
const TOWNS_KEY = `${CONFIG.storageKey}.towns`;

/** Build the self-contained payload describing the current world. */
function buildPayload(tileMap, camera, styleId, buildOrder) {
    return {
        v: 2,
        style: styleId ?? null,
        tileMap: tileMap.serialize(),
        buildOrder: buildOrder ?? null,
        camera: camera ? {
            offsetX: camera.offsetX,
            offsetY: camera.offsetY,
            zoom: camera.zoom,
        } : null,
    };
}

/** Apply a payload's tilemap + camera onto live objects. */
function applyPayload(data, tileMap, camera) {
    tileMap.deserialize(data.tileMap, d => new PlacedObject(d));
    if (camera && data.camera) {
        camera.offsetX = data.camera.offsetX;
        camera.offsetY = data.camera.offsetY;
        camera.zoom    = data.camera.zoom;
    }
}

export const SaveSystem = {
    /* Autosave slot */

    save(tileMap, camera, styleId = null, buildOrder = null) {
        try {
            localStorage.setItem(KEY, JSON.stringify(
                buildPayload(tileMap, camera, styleId, buildOrder),
            ));
            return true;
        } catch (e) {
            console.error('Save failed:', e);
            return false;
        }
    },

    load(tileMap, camera) {
        try {
            const raw = localStorage.getItem(KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            applyPayload(data, tileMap, camera);
            return true;
        } catch (e) {
            console.error('Load failed:', e);
            return false;
        }
    },

    clear() {
        try { localStorage.removeItem(KEY); } catch {}
    },

    /* Named "dream town" library */

    listTowns() {
        try {
            const raw = localStorage.getItem(TOWNS_KEY);
            const all = raw ? JSON.parse(raw) : {};
            return Object.entries(all).map(([name, t]) => ({
                name,
                savedAt: t.savedAt ?? null,
                style: t.style ?? null,
                objectCount: t.tileMap?.objects?.length ?? 0,
            })).sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
        } catch { return []; }
    },

    saveTown(name, tileMap, camera, styleId, buildOrder) {
        try {
            const raw = localStorage.getItem(TOWNS_KEY);
            const all = raw ? JSON.parse(raw) : {};
            all[name] = {
                ...buildPayload(tileMap, camera, styleId, buildOrder),
                name,
                savedAt: Date.now(),
            };
            localStorage.setItem(TOWNS_KEY, JSON.stringify(all));
            return true;
        } catch (e) {
            console.error('Save town failed:', e);
            return false;
        }
    },

    getTown(name) {
        try {
            const raw = localStorage.getItem(TOWNS_KEY);
            const all = raw ? JSON.parse(raw) : {};
            return all[name] ?? null;
        } catch { return null; }
    },

    deleteTown(name) {
        try {
            const raw = localStorage.getItem(TOWNS_KEY);
            const all = raw ? JSON.parse(raw) : {};
            delete all[name];
            localStorage.setItem(TOWNS_KEY, JSON.stringify(all));
            return true;
        } catch { return false; }
    },

    applyTown(town, tileMap, camera) {
        applyPayload(town, tileMap, camera);
    },

    exportTown(name, tileMap, camera, styleId, buildOrder) {
        return {
            format: 'dream-town/v1',
            name: name ?? 'Untitled Town',
            exportedAt: new Date().toISOString(),
            ...buildPayload(tileMap, camera, styleId, buildOrder),
        };
    },
};

/**
 * Peek at the saved autosave's style id (used at boot to pick which style to
 * load before constructing the game). Returns null if none.
 */
export function readSavedStyleId() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        return JSON.parse(raw).style ?? null;
    } catch { return null; }
}

/** Peek at the saved autosave's build order, if any. */
export function readSavedBuildOrder() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        return JSON.parse(raw).buildOrder ?? null;
    } catch { return null; }
}
