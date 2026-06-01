/**
 * DreamPanel.js
 *
 * The "dream town" control surface added on top of the base editor:
 *   1. Style switcher  — pick a town style; reloads the asset pack.
 *   2. Timeline        — 0→100 build-order slider + play button.
 *   3. Library         — save / load / export named dream towns.
 *
 * It owns its own DOM (built into #dream-panel) so index.html only needs an
 * empty mount point.
 */

import { getStyleList, getActiveStyleId } from '../assets/styleRegistry.js';
import { SaveSystem } from '../storage/SaveSystem.js';
import { playUiClick } from './Audio.js';

export class DreamPanel {
    constructor(mountEl, game) {
        this.el = mountEl;
        this.game = game;
        this._stopPlay = null;
        this._build();
        this.update();
    }

    _build() {
        this.el.innerHTML = `
          <div class="dp-section dp-styles">
            <div class="dp-label">Style</div>
            <div class="dp-style-list" id="dp-style-list"></div>
          </div>

          <div class="dp-section dp-timeline">
            <div class="dp-label">
              Timeline
              <button type="button" class="dp-mini" id="dp-tl-toggle">Preview build</button>
            </div>
            <div class="dp-tl-body hidden" id="dp-tl-body">
              <div class="dp-tl-note">👁 Preview only — your town isn't changed. Drag to see it build 0→100%.</div>
              <div class="dp-tl-row">
                <button type="button" class="dp-play" id="dp-play">▶ Play</button>
                <span class="dp-pct" id="dp-pct">100%</span>
              </div>
              <input type="range" min="0" max="100" value="100" class="dp-range" id="dp-range" />
              <div class="dp-stages" id="dp-stages"></div>
              <button type="button" class="dp-btn dp-tl-edit" id="dp-tl-edit">← Back to editing</button>
            </div>
          </div>

          <div class="dp-section dp-library">
            <div class="dp-label">My Towns</div>
            <div class="dp-lib-actions">
              <button type="button" class="dp-btn" id="dp-save">Save</button>
              <button type="button" class="dp-btn" id="dp-export">Export</button>
              <label class="dp-btn dp-import">Import<input type="file" id="dp-import-file" accept="application/json" hidden /></label>
            </div>
            <div class="dp-lib-list" id="dp-lib-list"></div>
          </div>
        `;

        // Style list
        this.styleListEl = this.el.querySelector('#dp-style-list');

        // Timeline
        this.tlToggle = this.el.querySelector('#dp-tl-toggle');
        this.tlBody   = this.el.querySelector('#dp-tl-body');
        this.playBtn  = this.el.querySelector('#dp-play');
        this.range    = this.el.querySelector('#dp-range');
        this.pctEl    = this.el.querySelector('#dp-pct');
        this.stagesEl = this.el.querySelector('#dp-stages');

        this.tlToggle.addEventListener('click', () => { playUiClick(); this._toggleTimeline(); });
        this.range.addEventListener('input', () => {
            const p = +this.range.value;
            this.pctEl.textContent = `${Math.round(p)}%`;
            this.game.setTimelineProgress(p);
            this._highlightStage(p);
        });
        this.playBtn.addEventListener('click', () => { playUiClick(); this._play(); });
        this.editBtn = this.el.querySelector('#dp-tl-edit');
        this.editBtn?.addEventListener('click', () => { playUiClick(); this._closeTimeline(); });

        // Library
        this.libList = this.el.querySelector('#dp-lib-list');
        this.el.querySelector('#dp-save').addEventListener('click', () => { playUiClick(); this._saveTown(); });
        this.el.querySelector('#dp-export').addEventListener('click', () => { playUiClick(); this._exportTown(); });
        this.el.querySelector('#dp-import-file').addEventListener('change', (e) => this._importTown(e));

        this._renderStyles();
        this._renderLibrary();
    }

    /* ── Styles ────────────────────────────────────────────────── */

    _renderStyles() {
        const styles = getStyleList();
        this.styleListEl.innerHTML = '';
        for (const s of styles) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'dp-style';
            btn.dataset.styleId = s.id;
            if (s.thumbnail) {
                const img = document.createElement('img');
                img.src = `assets/${s.thumbnail}`;
                img.alt = s.name;
                img.loading = 'lazy';
                img.onerror = () => { img.remove(); };
                btn.appendChild(img);
            }
            const label = document.createElement('span');
            label.textContent = s.name;
            btn.appendChild(label);
            btn.addEventListener('click', () => this._switchStyle(s.id));
            this.styleListEl.appendChild(btn);
        }
        this._highlightActiveStyle();
    }

    _highlightActiveStyle() {
        const active = getActiveStyleId();
        for (const b of this.styleListEl.querySelectorAll('.dp-style')) {
            b.classList.toggle('active', b.dataset.styleId === active);
        }
    }

    async _switchStyle(styleId) {
        if (styleId === getActiveStyleId()) return;
        playUiClick();
        // If timeline is open, exit it first (it snapshots the old style).
        if (this.game.isTimelineActive()) this._closeTimeline();
        this.game.ui?.showToast(`Loading ${styleId}…`);
        const ok = await this.game.switchStyle(styleId);
        if (ok) {
            this._highlightActiveStyle();
            this.game.ui?.showToast(`Style: ${styleId}`);
        }
    }

    /* ── Timeline ──────────────────────────────────────────────── */

    _toggleTimeline() {
        if (this.game.isTimelineActive()) this._closeTimeline();
        else this._openTimeline();
    }

    _openTimeline() {
        const order = this.game.enterTimeline();
        this.tlBody.classList.remove('hidden');
        this.tlToggle.textContent = 'Editing';
        this.range.value = 100;
        this.pctEl.textContent = '100%';
        this._renderStages(order);
        // Flag the whole app as being in preview mode so editor chrome dims
        // and the user clearly sees this is a non-editing state.
        document.body.classList.add('timeline-preview');
        this.game.ui?.showToast('Preview mode — your town is safe, editing is paused');
    }

    _closeTimeline() {
        this._stopPlayback();
        this.game.exitTimeline();
        this.tlBody.classList.add('hidden');
        this.tlToggle.textContent = 'Preview build';
        document.body.classList.remove('timeline-preview');
        this.game.ui?.showToast('Back to editing');
    }

    _renderStages(order) {
        this.stagesEl.innerHTML = '';
        if (!order) return;
        for (const st of order.stages) {
            const chip = document.createElement('div');
            chip.className = 'dp-stage';
            chip.dataset.start = st.start;
            chip.dataset.end = st.end;
            chip.style.flexGrow = String(Math.max(1, st.end - st.start));
            chip.innerHTML = `<span>${st.label}</span><small>${st.count}</small>`;
            this.stagesEl.appendChild(chip);
        }
        this._highlightStage(+this.range.value);
    }

    _highlightStage(p) {
        for (const chip of this.stagesEl.querySelectorAll('.dp-stage')) {
            const inRange = p >= +chip.dataset.start;
            chip.classList.toggle('reached', inRange);
        }
    }

    _play() {
        if (!this.game.isTimelineActive()) this._openTimeline();
        this._stopPlayback();
        this.playBtn.textContent = '⏸ Playing';
        this._stopPlay = this.game.timeline.play(0, 100, 6000, (p) => {
            this.range.value = p;
            this.pctEl.textContent = `${Math.round(p)}%`;
            this._highlightStage(p);
            if (p >= 100) { this.playBtn.textContent = '▶ Play'; this._stopPlay = null; }
        });
    }

    _stopPlayback() {
        if (this._stopPlay) { this._stopPlay(); this._stopPlay = null; }
        this.playBtn.textContent = '▶ Play';
    }

    /* ── Library ───────────────────────────────────────────────── */

    _renderLibrary() {
        const towns = SaveSystem.listTowns();
        this.libList.innerHTML = '';
        if (!towns.length) {
            this.libList.innerHTML = '<div class="dp-empty">No saved towns yet</div>';
            return;
        }
        for (const t of towns) {
            const row = document.createElement('div');
            row.className = 'dp-lib-row';
            row.innerHTML = `
              <button type="button" class="dp-lib-load" data-name="${escapeAttr(t.name)}">
                <strong>${escapeHtml(t.name)}</strong>
                <small>${t.style ?? '—'} · ${t.objectCount} objs</small>
              </button>
              <button type="button" class="dp-lib-del" data-name="${escapeAttr(t.name)}" title="Delete">✕</button>
            `;
            row.querySelector('.dp-lib-load').addEventListener('click', async (e) => {
                playUiClick();
                if (this.game.isTimelineActive()) this._closeTimeline();
                await this.game.loadTown(e.currentTarget.dataset.name);
            });
            row.querySelector('.dp-lib-del').addEventListener('click', (e) => {
                playUiClick();
                SaveSystem.deleteTown(e.currentTarget.dataset.name);
                this._renderLibrary();
            });
            this.libList.appendChild(row);
        }
    }

    _saveTown() {
        const name = prompt('Name this dream town:', `Town ${new Date().toLocaleDateString()}`);
        if (!name) return;
        if (this.game.saveTown(name.trim())) this._renderLibrary();
    }

    _exportTown() {
        const name = prompt('Export name:', 'My Dream Town');
        if (!name) return;
        const obj = this.game.exportTownObject(name.trim());
        const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${slug(name)}.dreamtown.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.game.ui?.showToast('Exported JSON');
    }

    _importTown(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            try {
                const town = JSON.parse(reader.result);
                if (town.style && town.style !== this.game.styleId) {
                    await this.game.switchStyle(town.style);
                }
                if (this.game.isTimelineActive()) this._closeTimeline();
                SaveSystem.applyTown(town, this.game.tileMap, this.game.camera);
                this.game.renderer.rebuildAll();
                this.game.ui?.update();
                this.game.ui?.showToast(`Imported “${town.name ?? 'town'}”`);
            } catch (err) {
                console.error(err);
                this.game.ui?.showToast('Import failed — bad file');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    update() {
        this._highlightActiveStyle();
        this._renderLibrary();
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'town'; }
