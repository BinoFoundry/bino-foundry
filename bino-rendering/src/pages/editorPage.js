import { PolygonEditor } from '../mask/PolygonEditor.js';
import { EditorTool } from '../mask/editorInteraction.js';
import { createMaskConfig, isMaskConfigValid } from '../mask/types.js';
import { pathsToMaskCanvas } from '../mask/bezierPath.js';
import { navigate, getRenderPath } from '../router.js';
import {
  getAsset,
  getInitialLensesForEditor,
  saveAssetMaskConfig,
} from '../storage/assetStore.js';
import { loadImage } from '../lensCompositor.js';

/** @type {PolygonEditor | null} */
let editor = null;
/** @type {(() => void) | null} */
let cleanup = null;

/**
 * @param {HTMLElement} root
 * @param {{ id: string }} params
 */
export async function mountEditorPage(root, params) {
  cleanup?.();
  cleanup = null;

  const asset = await getAsset(params.id);
  if (!asset) {
    root.innerHTML =
      '<div class="panel"><p>Asset not found.</p><a href="#/admin">Back to library</a></div>';
    return;
  }

  const image = await loadImage(asset.sourceDataUrl);
  const lenses = getInitialLensesForEditor(asset);

  root.innerHTML = `
    <div class="page-editor">
      <div class="editor-toolbar panel">
        <div class="toolbar-group">
          <span class="toolbar-label">Tool</span>
          <div id="editor-tools" class="editor-tools">
            <button type="button" class="tool-btn active" data-tool="draw" title="Draw path (P)">Draw</button>
            <button type="button" class="tool-btn" data-tool="select" title="Select (V)">Select</button>
            <button type="button" class="tool-btn" data-tool="navigate" title="Pan (H)">Pan</button>
          </div>
        </div>
        <div class="toolbar-group">
          <span class="toolbar-label">Lens</span>
          <div id="lens-tabs" class="lens-tabs"></div>
        </div>
        <div class="toolbar-group">
          <button type="button" class="btn ghost btn-sm" id="btn-undo-point">Undo point</button>
          <button type="button" class="btn ghost btn-sm" id="btn-clear-lens">Clear lens</button>
          <button type="button" class="btn ghost btn-sm" id="btn-fit">Fit view</button>
          <button type="button" class="btn ghost btn-sm" id="btn-toggle-curve">Toggle curve (C)</button>
          <label class="chk"><input type="checkbox" id="chk-preview" checked /> Mask preview</label>
          <label class="chk"><input type="checkbox" id="chk-handles" checked /> Curve handles</label>
        </div>
        <div class="toolbar-group toolbar-actions">
          <a href="#/admin" class="btn ghost btn-sm">Cancel</a>
          <button type="button" class="btn primary btn-sm" id="btn-save">Save mask</button>
        </div>
      </div>
      <p class="editor-hint">
        <strong>Draw</strong> (P): click to add anchors · <strong>Select</strong> (V): pick anchors ·
        <strong>Pan</strong> (H): drag to move view · scroll to zoom ·
        <kbd>Space</kbd> temporary pan · <kbd>C</kbd> / double-click toggles curve ·
        <kbd>Shift</kbd>+click on path inserts point · <kbd>Del</kbd> removes
      </p>
      <div class="editor-stage panel">
        <canvas id="mask-canvas"></canvas>
      </div>
      <div class="editor-footer panel">
        <div>
          <strong>${escapeHtml(asset.name)}</strong>
          <span class="muted">${asset.width}×${asset.height}</span>
        </div>
        <div id="mask-status" class="mask-status">—</div>
        <canvas id="mask-thumb" class="mask-thumb" width="200" height="80"></canvas>
      </div>
    </div>
  `;

  const canvas = root.querySelector('#mask-canvas');
  const lensTabs = root.querySelector('#lens-tabs');
  const statusEl = root.querySelector('#mask-status');
  const thumbCanvas = root.querySelector('#mask-thumb');

  function renderLensTabs() {
    if (!editor) return;
    lensTabs.innerHTML = editor.lenses
      .map(
        (l, i) =>
          `<button type="button" class="lens-tab ${i === editor.activeLensIndex ? 'active' : ''}" data-index="${i}">${escapeHtml(l.label)} (${l.points.length})</button>`,
      )
      .join('');
  }

  function updateThumbAndStatus() {
    if (!editor) return;
    const config = createMaskConfig(asset.width, asset.height, editor.getLenses());
    const valid = isMaskConfigValid(config);
    statusEl.textContent = valid
      ? 'Ready to save — mask defines editable lens region'
      : 'Add 3+ points per lens polygon';
    statusEl.className = 'mask-status ' + (valid ? 'ok' : 'warn');

    const mask = pathsToMaskCanvas(asset.width, asset.height, config.lenses);
    const ctx = thumbCanvas.getContext('2d');
    const scale = Math.min(thumbCanvas.width / asset.width, thumbCanvas.height / asset.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, thumbCanvas.width, thumbCanvas.height);
    ctx.drawImage(
      mask,
      0,
      0,
      asset.width,
      asset.height,
      0,
      0,
      asset.width * scale,
      asset.height * scale,
    );
    renderLensTabs();
  }

  const editorTools = root.querySelector('#editor-tools');
  const TOOL_MAP = {
    draw: EditorTool.DRAW,
    select: EditorTool.SELECT,
    navigate: EditorTool.NAVIGATE,
  };

  function syncToolButtons() {
    if (!editor || !editorTools) return;
    const active = editor.getTool();
    editorTools.querySelectorAll('.tool-btn').forEach((btn) => {
      btn.classList.toggle('active', TOOL_MAP[btn.dataset.tool] === active);
    });
  }

  editor = new PolygonEditor(canvas, image, lenses, {
    onChange: updateThumbAndStatus,
    onToolChange: syncToolButtons,
  });

  editorTools?.addEventListener('click', (e) => {
    const btn = e.target.closest('.tool-btn');
    if (!btn) return;
    const tool = TOOL_MAP[btn.dataset.tool];
    if (tool) editor.setTool(tool);
  });
  syncToolButtons();

  const onResize = () => {
    editor.resize();
    editor.fitToView();
  };
  window.addEventListener('resize', onResize);
  onResize();
  updateThumbAndStatus();

  lensTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.lens-tab');
    if (!tab) return;
    editor.setActiveLens(Number(tab.dataset.index));
    renderLensTabs();
  });

  root.querySelector('#btn-undo-point').addEventListener('click', () => editor.undoLastPoint());
  root.querySelector('#btn-clear-lens').addEventListener('click', () => {
    if (confirm('Clear all points for this lens?')) editor.clearActiveLens();
  });
  root.querySelector('#btn-fit').addEventListener('click', () => editor.fitToView());
  root.querySelector('#btn-toggle-curve').addEventListener('click', () => {
    if (editor.selectedPointIndex >= 0) editor.toggleSegmentAt(editor.selectedPointIndex);
  });
  root.querySelector('#chk-handles').addEventListener('change', (e) => {
    editor.showHandles = e.target.checked;
    editor.draw();
  });
  root.querySelector('#chk-preview').addEventListener('change', (e) => {
    editor.showPreview = e.target.checked;
    editor.draw();
  });

  root.querySelector('#btn-save').addEventListener('click', async () => {
    const config = createMaskConfig(asset.width, asset.height, editor.getLenses());
    if (!isMaskConfigValid(config)) {
      alert('Each lens needs at least 3 points. Complete both lens polygons before saving.');
      return;
    }
    await saveAssetMaskConfig(asset.id, config);
    navigate(getRenderPath(asset.id));
  });

  const teardown = () => {
    window.removeEventListener('resize', onResize);
    editor?.destroy();
    editor = null;
  };
  cleanup = teardown;
  return teardown;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
