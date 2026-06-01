/**
 * TimelineController.js
 *
 * Drives the 0→100 "watch the town build itself" experience on top of a
 * finished layout. It snapshots the complete town once, computes the staged
 * build order, and then `applyProgress(percent)` mutates the live TileMap so
 * only the steps due at that progress level are present.
 *
 * This is the clean seam for the sponsorship platform: a funding bar simply
 * calls `applyProgress(fundedPercent)`.
 *
 * Entering timeline mode is non-destructive — `exit()` restores the full
 * town exactly as it was.
 */

import { PlacedObject } from '../building/PlacedObject.js';
import { computeBuildOrder, stepsVisibleAt } from './BuildOrder.js';

export class TimelineController {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.order = null;        // { steps, stages }
        this._snapshot = null;    // full town serialization
        this.percent = 100;
    }

    /** Capture the current town and compute its build order. */
    enter(assetIndex) {
        const tm = this.game.tileMap;
        // Deep-clone so our snapshot survives the in-place clearAll()
        // mutations applyProgress() performs on the live TileMap.
        this._snapshot = JSON.parse(JSON.stringify(tm.serialize()));
        this.order = computeBuildOrder(tm, assetIndex);
        this.active = true;
        return this.order;
    }

    /** Restore the full town and leave timeline mode. */
    exit() {
        if (!this.active) return;
        this._restoreFull();
        this.active = false;
        this.order = null;
        this._snapshot = null;
    }

    /** Re-apply the full snapshot to the tile map. */
    _restoreFull() {
        if (!this._snapshot) return;
        this.game.tileMap.deserialize(this._snapshot, d => new PlacedObject(d));
        this.game.renderer.rebuildAll();
    }

    /**
     * The FULL town serialization captured on enter() — i.e. the town as it
     * was before any progress preview mutated the live TileMap. Save/export
     * use this so persisting while previewing never captures a partial build.
     * Returns null when not in timeline mode.
     */
    getFullSnapshot() {
        return this._snapshot ? JSON.parse(JSON.stringify(this._snapshot)) : null;
    }

    /**
     * Render the town as it should look at `percent` (0–100). Rebuilds the
     * TileMap from the snapshot but only includes steps whose threshold has
     * been reached.
     */
    applyProgress(percent) {
        if (!this.active || !this.order) return;
        this.percent = Math.max(0, Math.min(100, percent));

        const visible = new Set(
            stepsVisibleAt(this.order, this.percent).map(s => s.key),
        );

        const tm = this.game.tileMap;
        // Start from an empty board, then re-add only visible steps from the
        // snapshot so positions/flips match exactly.
        tm.clearAll();

        // Terrain
        const W = tm.width;
        const terr = this._snapshot.terrain;
        for (let i = 0; i < terr.length; i++) {
            const id = terr[i];
            if (!id) continue;
            const gx = i % W, gy = Math.floor(i / W);
            if (visible.has(`t:${gx},${gy}`)) tm.setTerrain(gx, gy, id);
        }
        // Objects
        for (const od of this._snapshot.objects) {
            if (visible.has(`o:${od.id}`)) {
                tm.addObject(new PlacedObject(od));
            }
        }

        this.game.renderer.rebuildAll();
    }

    /**
     * Animate the build from `from`→`to` over `ms`, stepping progress so the
     * town assembles itself. Returns a stop() function.
     */
    play(from = 0, to = 100, ms = 6000, onTick = () => {}) {
        if (!this.active) return () => {};
        const start = performance.now();
        let raf = 0;
        const tick = (now) => {
            const t = Math.min(1, (now - start) / ms);
            const p = from + (to - from) * t;
            this.applyProgress(p);
            onTick(p);
            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }
}
