/**
 * BuildOrder.js
 *
 * Turns a finished town into an ordered 0→100 construction sequence.
 *
 * A "step" is one placement (a terrain cell or an object). Steps are grouped
 * into named build *stages* (ground → water → paths → walls → details →
 * housing → landmarks). Each stage owns a contiguous slice of the 0–100
 * progress axis, sized by a fixed weight so the reveal has rhythm: the ground
 * carpets in first, walls go up in the middle, the landmark chapel/windmill
 * tops it off near 100. Within a stage, steps are ordered back-to-front
 * (smallest gx+gy first) so the build ripples across the island.
 *
 * The result is an array of steps, each annotated with the progress percent
 * at which it appears. `applyProgress(percent)` then returns the set of steps
 * that should be visible at a given 0–100 value — the clean hook the
 * sponsorship platform's funding bar will drive.
 */

// Stage order (early → late) and relative weight (share of the 0–100 axis).
export const STAGES = [
    { id: 'ground',    label: 'Ground',    weight: 14 },
    { id: 'water',     label: 'Water',     weight: 8  },
    { id: 'paths',     label: 'Paths',     weight: 10 },
    { id: 'walls',     label: 'Walls',     weight: 14 },
    { id: 'details',   label: 'Details',   weight: 18 },
    { id: 'housing',   label: 'Housing',   weight: 22 },
    { id: 'landmarks', label: 'Landmarks', weight: 14 },
];

const STAGE_INDEX = STAGES.reduce((m, s, i) => { m[s.id] = i; return m; }, {});

// Asset ids that read as "walls / fences / railings / arches".
const WALL_IDS = new Set([
    'low_wall', 'corner_wall', 'blue_railing', 'gate_fence', 'archway', 'sea_wall',
]);
// Building ids that should land in the climactic "landmarks" stage.
const LANDMARK_IDS = new Set([
    'main_chapel', 'tower_chapel', 'windmill', 'villa', 'altar',
]);

/**
 * Decide which stage a manifest asset belongs to. Honours an explicit
 * `buildStage` on the asset (from a style pack) first, then falls back to
 * category/kind/id heuristics.
 *
 * @param {object} asset  manifest entry (has id, category, kind, buildStage?)
 */
export function stageForAsset(asset) {
    if (!asset) return 'details';
    if (asset.buildStage && STAGE_INDEX[asset.buildStage] != null) {
        return asset.buildStage;
    }
    if (asset.kind === 'terrain') {
        if (asset.id === 'water') return 'water';
        if (asset.id === 'path' || asset.id === 'stairs') return 'paths';
        return 'ground';                       // grass, sand, stone, sea_wall*
    }
    if (asset.category === 'water') return 'water';
    if (WALL_IDS.has(asset.id)) return 'walls';
    if (asset.category === 'buildings') {
        return LANDMARK_IDS.has(asset.id) ? 'landmarks' : 'housing';
    }
    // nature + remaining props
    return 'details';
}

/** Back-to-front ripple key for a cell / object origin. */
function rippleKey(gx, gy) { return gx + gy; }

/**
 * Compute the ordered build sequence for a tile map.
 *
 * @param {TileMap} tileMap
 * @param {object}  assetIndex  ASSET_INDEX (id -> manifest entry)
 * @returns {{steps: Array, stages: Array}}
 *   steps: [{ key, type, assetId, gx, gy, stage, stageIndex, progress }]
 *   stages: per-stage summary [{ id, label, start, end, count }]
 */
export function computeBuildOrder(tileMap, assetIndex) {
    const buckets = STAGES.map(() => []);

    // Terrain cells
    for (let gy = 0; gy < tileMap.height; gy++) {
        for (let gx = 0; gx < tileMap.width; gx++) {
            const id = tileMap.getTerrain(gx, gy);
            if (!id) continue;
            const stage = stageForAsset(assetIndex[id]);
            buckets[STAGE_INDEX[stage]].push({
                key: `t:${gx},${gy}`, type: 'terrain', assetId: id, gx, gy, stage,
            });
        }
    }
    // Objects
    for (const obj of tileMap.objects) {
        const stage = stageForAsset(assetIndex[obj.assetId]);
        buckets[STAGE_INDEX[stage]].push({
            key: `o:${obj.id}`, type: 'object', assetId: obj.assetId,
            gx: obj.gx, gy: obj.gy, stage,
        });
    }

    // Sort each bucket back-to-front for a pleasing ripple.
    for (const b of buckets) {
        b.sort((a, c) => rippleKey(a.gx, a.gy) - rippleKey(c.gx, c.gy));
    }

    // Allocate the 0–100 axis across stages by weight, but skip empty stages
    // so their slice isn't wasted (re-normalise over non-empty stages).
    const activeStages = STAGES
        .map((s, i) => ({ ...s, i, count: buckets[i].length }))
        .filter(s => s.count > 0);
    const totalWeight = activeStages.reduce((sum, s) => sum + s.weight, 0) || 1;

    const steps = [];
    const stageSummary = [];
    let cursor = 0;
    for (const s of activeStages) {
        const span = (s.weight / totalWeight) * 100;
        const start = cursor;
        const end = cursor + span;
        const bucket = buckets[s.i];
        bucket.forEach((step, idx) => {
            // Distribute steps evenly across [start, end].
            const t = bucket.length === 1 ? 0 : idx / (bucket.length - 1);
            steps.push({
                ...step,
                stageIndex: s.i,
                progress: +(start + t * span).toFixed(2),
            });
        });
        stageSummary.push({
            id: s.id, label: s.label,
            start: +start.toFixed(1), end: +end.toFixed(1), count: s.count,
        });
        cursor = end;
    }

    return { steps, stages: stageSummary };
}

/**
 * Given a computed build order and a 0–100 progress value, return the steps
 * that should be visible. A step is visible once progress reaches its
 * `progress` threshold.
 */
export function stepsVisibleAt(order, percent) {
    const p = Math.max(0, Math.min(100, percent));
    return order.steps.filter(s => s.progress <= p);
}

/** Serialise just the ordering (array of step keys) for persistence. */
export function serializeOrder(order) {
    return order.steps.map(s => s.key);
}
