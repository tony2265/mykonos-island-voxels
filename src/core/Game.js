/**
 * Game.js
 *
 * Top-level game controller. Owns the world (TileMap), camera, renderer,
 * input manager, placement system, and UI. Exposes a small intent API
 * (setTool, selectAsset, save, reset, …) consumed by the UI.
 */

import { CONFIG } from '../config.js';
import { Camera } from './Camera.js';
import { Renderer } from './Renderer.js';
import { InputManager } from './InputManager.js';
import { TileMap } from '../grid/TileMap.js';
import { PlacementSystem } from '../building/PlacementSystem.js';
import { PlacedObject } from '../building/PlacedObject.js';
import { ASSET_INDEX, ASSET_MANIFEST, setActiveManifest } from '../assets/assetManifest.js';
import { reloadAssets } from '../assets/assetLoader.js';
import { loadStyleManifest, setActiveStyleId, getActiveStyleId } from '../assets/styleRegistry.js';
import { SaveSystem, readSavedBuildOrder } from '../storage/SaveSystem.js';
import { cellToScreen } from '../grid/IsoGrid.js';
import { playPlacementFor } from '../ui/Audio.js';
import { TimelineController } from '../timeline/TimelineController.js';
import { computeBuildOrder } from '../timeline/BuildOrder.js';

export class Game {
    constructor(canvas, ui = null) {
        this.canvas = canvas;
        this.tileMap = new TileMap();
        this.camera = new Camera();
        this.renderer = new Renderer(canvas, this.camera, this.tileMap);
        this.placement = new PlacementSystem(this.tileMap);
        this.input = new InputManager(canvas, this.camera, this);
        this.timeline = new TimelineController(this);

        // Any camera mutation (pan/zoom/recenter) needs the next frame
        // re-rendered. The renderer itself is otherwise idle.
        this.camera.onChange(() => this.renderer.markDirty());

        // Default selection
        this.tool = 'place';                  // 'place' | 'erase' | 'pan'
        this.category = 'terrain';
        this.selectedAssetId = ASSET_MANIFEST.find(a => a.category === 'terrain').id;
        this.ui = ui;

        // Preview-only flip state for the current selection. Toggled by the
        // user (H / V) before commit; the values are baked into the
        // PlacedObject when the asset is placed.
        this.flipH = false;
        this.flipV = false;

        // Center camera over grid
        this._centerCamera();

        // Animation loop
        this._loop = this._loop.bind(this);
        requestAnimationFrame(this._loop);
    }

    _centerCamera() {
        const c = cellToScreen(this.tileMap.width / 2, this.tileMap.height / 2);
        const { innerWidth: w, innerHeight: h } = window;
        this.camera.centerOn(c.x, c.y, w, h);
    }

    /* ── Intents from UI / input ──────────────────────────────── */

    setTool(t) {
        this.tool = t;
        this.renderer.eraseMode = (t === 'erase');
        this.canvas.style.cursor = t === 'pan' ? 'grab'
                                  : t === 'erase' ? 'crosshair'
                                  : 'crosshair';
        this.renderer.markDirty();
        this.ui?.update();
    }

    setCategory(cat) {
        if (this.category === cat) return;
        this.category = cat;
        // Auto-select first asset of that category.
        const first = ASSET_MANIFEST.find(a => a.category === cat);
        if (first) this.selectedAssetId = first.id;
        this._resetFlip();
        this.renderer.markDirty();
        this.ui?.update();
    }

    selectAsset(id) {
        const a = ASSET_INDEX[id];
        if (!a) return;
        const changed = this.selectedAssetId !== id;
        this.selectedAssetId = id;
        this.category = a.category;
        if (changed) this._resetFlip();
        // Picking an asset implies "place" mode.
        if (this.tool === 'erase') this.setTool('place');
        this.renderer.markDirty();
        this.ui?.update();
    }

    toggleFlipH() {
        this.flipH = !this.flipH;
        this._syncPreviewFlip();
        this.renderer.markDirty();
        this.ui?.showToast(`Flip horizontal: ${this.flipH ? 'on' : 'off'}`);
        this.ui?.update();
    }

    toggleFlipV() {
        this.flipV = !this.flipV;
        this._syncPreviewFlip();
        this.renderer.markDirty();
        this.ui?.showToast(`Flip vertical: ${this.flipV ? 'on' : 'off'}`);
        this.ui?.update();
    }

    _resetFlip() {
        this.flipH = false;
        this.flipV = false;
        this._syncPreviewFlip();
    }

    _syncPreviewFlip() {
        this.renderer.previewFlipH = this.flipH;
        this.renderer.previewFlipV = this.flipV;
    }

    toggleGrid() {
        this.renderer.showGrid = !this.renderer.showGrid;
        this.renderer.markDirty();
        this.ui?.hud?.syncToggles();
        this.ui?.update();
    }

    save() {
        // Always persist the COMPLETE town, even if the timeline preview is
        // currently showing a partial build. _withFullTown guarantees the
        // live TileMap holds the full layout for the duration of the save.
        const ok = this._withFullTown(() => SaveSystem.save(
            this.tileMap, this.camera, this.styleId, this._buildOrderKeys(),
        ));
        this.ui?.showToast(ok ? 'Saved your island' : 'Save failed');
    }

    load() {
        const ok = SaveSystem.load(this.tileMap, this.camera);
        if (ok) this.renderer.markDirty();
        return ok;
    }

    /**
     * Run `fn` with the live TileMap holding the FULL town, then restore
     * whatever state was showing before. While in timeline preview the live
     * map only holds a partial build, so save/export temporarily swap the
     * full snapshot in, serialize, and swap the preview back — the user sees
     * no flicker and never persists a half-built town.
     */
    _withFullTown(fn) {
        if (!this.timeline.active) return fn();
        const full = this.timeline.getFullSnapshot();
        const previewPercent = this.timeline.percent;
        // Swap full town in.
        this.tileMap.deserialize(full, d => new PlacedObject(d));
        try {
            return fn();
        } finally {
            // Swap the preview back exactly as it was.
            this.timeline.applyProgress(previewPercent);
        }
    }

    /** Current build-order step keys (for persistence), computed on demand. */
    _buildOrderKeys() {
        try {
            return computeBuildOrder(this.tileMap, ASSET_INDEX).steps.map(s => s.key);
        } catch { return null; }
    }

    /* Timeline (0->100 build order) — a NON-DESTRUCTIVE preview mode. */

    enterTimeline() {
        const order = this.timeline.enter(ASSET_INDEX);
        this.timeline.applyProgress(100);
        this.ui?.update();
        return order;
    }

    setTimelineProgress(percent) {
        this.timeline.applyProgress(percent);
    }

    exitTimeline() {
        this.timeline.exit();
        this.ui?.update();
    }

    isTimelineActive() {
        return this.timeline.active;
    }

    /**
     * Called when the user tries to edit (place/erase) while the timeline
     * preview is open. We don't silently apply the edit to a partial build;
     * instead we tell them to exit preview first. The Dream Panel also offers
     * an explicit "Edit" exit, so this is the safety net for stray clicks.
     */
    _bumpTimelineEditAttempt() {
        this.ui?.showToast('Previewing build — click “Edit” to make changes');
    }

    /* Named dream-town saves + export */

    saveTown(name) {
        const ok = this._withFullTown(() => SaveSystem.saveTown(
            name, this.tileMap, this.camera, this.styleId, this._buildOrderKeys(),
        ));
        this.ui?.showToast(ok ? `Saved “${name}”` : 'Save failed');
        return ok;
    }

    async loadTown(name) {
        // Loading replaces the whole world; never do it mid-preview.
        if (this.timeline.active) this.exitTimeline();
        const town = SaveSystem.getTown(name);
        if (!town) { this.ui?.showToast('Town not found'); return false; }
        if (town.style && town.style !== this.styleId) {
            await this.switchStyle(town.style);
        }
        SaveSystem.applyTown(town, this.tileMap, this.camera);
        this.renderer.rebuildAll();
        this.ui?.update();
        this.ui?.showToast(`Loaded “${name}”`);
        return true;
    }

    exportTownObject(name) {
        return this._withFullTown(() => SaveSystem.exportTown(
            name, this.tileMap, this.camera, this.styleId, this._buildOrderKeys(),
        ));
    }

    reset() {
        if (this.timeline.active) this.exitTimeline();
        this.tileMap.clearAll();
        SaveSystem.clear();
        this._centerCamera();
        this.renderer.markDirty();
        this.ui?.showToast('World reset');
    }

    get styleId() {
        return getActiveStyleId();
    }

    async switchStyle(styleId, onProgress = () => {}) {
        if (styleId === getActiveStyleId() && ASSET_MANIFEST.length) return true;
        if (this.timeline.active) this.exitTimeline();
        try {
            const manifest = await loadStyleManifest(styleId);
            setActiveManifest(manifest);
            setActiveStyleId(styleId);
            await reloadAssets(onProgress);
            this._pruneToManifest();
            if (!ASSET_INDEX[this.selectedAssetId]) {
                const first = ASSET_MANIFEST.find(a => a.category === this.category)
                    ?? ASSET_MANIFEST[0];
                if (first) {
                    this.selectedAssetId = first.id;
                    this.category = first.category;
                }
            }
            this.renderer.rebuildAll();
            this.ui?.palette?.rebuild();
            this.ui?.update();
            return true;
        } catch (e) {
            console.error('Style switch failed:', e);
            this.ui?.showToast(`Couldn't load "${styleId}"`);
            return false;
        }
    }

    _pruneToManifest() {
        const tm = this.tileMap;
        for (let i = tm.objects.length - 1; i >= 0; i--) {
            if (!ASSET_INDEX[tm.objects[i].assetId]) {
                tm.removeObjectAt(tm.objects[i].gx, tm.objects[i].gy);
            }
        }
        for (let i = 0; i < tm.terrain.length; i++) {
            const id = tm.terrain[i];
            if (id && !ASSET_INDEX[id]) tm.terrain[i] = null;
        }
        tm.terrainVersion++;
        tm.objectsVersion++;
    }

    /**
     * Carpet the entire grid with grass in one click. Empty cells get a
     * fresh grass tile; cells whose terrain is already something else
     * (path, sand, water) are left alone so the user doesn't lose any
     * intentional terrain work. Each tile is queued through the same
     * staggered animation pipeline as the starter scene so the fill
     * ripples diagonally across the island instead of snapping in flat.
     *
     * Returns the number of cells that were actually filled.
     */
    fillGrass() {
        if (this.timeline.active) { this._bumpTimelineEditAttempt(); return 0; }
        const W = this.tileMap.width;
        const H = this.tileMap.height;
        // Same wave timing as the starter scene reveal so the two feel
        // like one consistent visual language.
        const STEP_MS = 32;
        let filled = 0;
        for (let gy = 0; gy < H; gy++)
        for (let gx = 0; gx < W; gx++) {
            if (this.tileMap.getTerrain(gx, gy)) continue;
            if (this.placeAndAnimate('grass', gx, gy, { delay: (gx + gy) * STEP_MS })) {
                filled++;
            }
        }
        if (filled > 0) {
            // One sound at the start; the per-tile placement audio path
            // would fire ~196 times in a fraction of a second otherwise.
            playPlacementFor('grass');
            this.ui?.showToast(`Filled ${filled} ${filled === 1 ? 'tile' : 'tiles'} with grass`);
        } else {
            this.ui?.showToast('Grid already covered');
        }
        return filled;
    }

    /* ── Mouse callbacks (called by InputManager) ─────────────── */

    onHover(cell) {
        const prev = this.renderer.hoverCell;
        const sameCell = prev && prev.gx === cell.gx && prev.gy === cell.gy;
        this.renderer.hoverCell = cell;
        if (this.timeline.active) {
            // Preview mode: no placement/erase ghost.
            this.renderer.previewAssetId = null;
            this.renderer.previewValid = true;
            if (!sameCell) this.renderer.markDirty();
            return;
        }
        if (this.tool === 'erase') {
            this.renderer.previewAssetId = null;
            this.renderer.previewValid = !!this.tileMap.objectAt(cell.gx, cell.gy)
                || !!this.tileMap.getTerrain(cell.gx, cell.gy);
        } else if (this.tool === 'place') {
            this.renderer.previewAssetId = this.selectedAssetId;
            this.renderer.previewValid = this.placement.canPlace(this.selectedAssetId, cell.gx, cell.gy);
        } else {
            this.renderer.previewAssetId = null;
            this.renderer.previewValid = true;
        }
        // Only invalidate the next frame when the highlighted cell or its
        // validity actually changed. Hover events fire on every mousemove
        // pixel, so this matters.
        if (!sameCell) this.renderer.markDirty();
    }

    onPrimaryClick(gx, gy) {
        if (!this.tileMap.inBounds(gx, gy)) return;
        if (this.timeline.active) { this._bumpTimelineEditAttempt(); return; }
        if (this.tool === 'erase') {
            // Capture what's about to be removed so we can pick the right
            // SFX (water erase splashes, everything else thuds).
            const objHere = this.tileMap.objectAt(gx, gy);
            const terrainHere = this.tileMap.getTerrain(gx, gy);
            const targetId = objHere ? objHere.assetId : terrainHere;
            if (this.placement.erase(gx, gy)) {
                this.renderer.markDirty();
                playPlacementFor(targetId);
            }
        } else if (this.tool === 'place') {
            const result = this.placement.place(this.selectedAssetId, gx, gy, {
                flipH: this.flipH,
                flipV: this.flipV,
            });
            if (result?.kind === 'object') {
                const o = result.object;
                this.renderer.spawnAnim(`obj-${o.id}`, {
                    gx: o.gx,
                    gy: o.gy,
                    w: o.footprint?.w ?? 1,
                    d: o.footprint?.d ?? 1,
                });
                playPlacementFor(o.assetId);
            } else if (result?.kind === 'terrain') {
                this.renderer.spawnAnim(`t-${result.gx},${result.gy}`, {
                    gx: result.gx,
                    gy: result.gy,
                    w: 1,
                    d: 1,
                });
                playPlacementFor(result.assetId);
            }
        }
    }

    onSecondaryClick(gx, gy) {
        // Right click always erases.
        if (!this.tileMap.inBounds(gx, gy)) return;
        if (this.timeline.active) { this._bumpTimelineEditAttempt(); return; }
        const objHere = this.tileMap.objectAt(gx, gy);
        const terrainHere = this.tileMap.getTerrain(gx, gy);
        const targetId = objHere ? objHere.assetId : terrainHere;
        if (this.placement.erase(gx, gy)) {
            this.renderer.markDirty();
            playPlacementFor(targetId);
        }
    }

    /**
     * Place an asset and queue its elastic placement animation, optionally
     * delayed by `opts.delay` milliseconds. Used by the starter-scene
     * reveal to ripple the seeded village in back-to-front so first-run
     * players see the world build itself instead of just appearing.
     *
     * Returns the placement result (or null if the placement was rejected).
     */
    placeAndAnimate(assetId, gx, gy, opts = {}) {
        const result = this.placement.place(assetId, gx, gy, {
            flipH: !!opts.flipH,
            flipV: !!opts.flipV,
        });
        if (!result) return null;
        const startAt = performance.now() + (opts.delay ?? 0);
        const duration = opts.duration ?? 460;
        if (result.kind === 'object') {
            const o = result.object;
            this.renderer.spawnAnim(`obj-${o.id}`, {
                gx: o.gx,
                gy: o.gy,
                w: o.footprint?.w ?? 1,
                d: o.footprint?.d ?? 1,
            }, duration, startAt);
        } else if (result.kind === 'terrain') {
            this.renderer.spawnAnim(`t-${result.gx},${result.gy}`, {
                gx: result.gx,
                gy: result.gy,
                w: 1,
                d: 1,
            }, duration, startAt);
        }
        return result;
    }

    /* ── Frame loop ───────────────────────────────────────────── */

    _loop() {
        // The renderer skips its own work when nothing has changed and
        // there are no animations running, so this loop is effectively
        // free at idle. We still keep `requestAnimationFrame` ticking so
        // we resume instantly when input or animations resume.
        this.renderer.draw();
        requestAnimationFrame(this._loop);
    }
}
