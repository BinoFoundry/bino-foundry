import { buildFromSourceImage, detectLensMask } from '../autoLensMask.js';
import { loadAssetForRendering } from '../mask/applyMaskConfig.js';
import { loadReferenceDemo } from '../referenceDemo.js';
import {
  buildMaskFromRegions,
  imageFromFile,
  loadImage,
  maskFromFile,
  renderAutoRecolor,
  renderComposite,
} from '../lensCompositor.js';
import { listAssets, getAsset } from '../storage/assetStore.js';

const state = {
  sourceImage: null,
  frameImage: null,
  backImage: null,
  maskCanvas: null,
  maskMode: 'auto',
  regions: [
    { x: 32, y: 48, w: 22, h: 14, rotation: -2 },
    { x: 68, y: 48, w: 22, h: 14, rotation: 2 },
  ],
  lensColor: '#3a3a3e',
  lensOpacity: 0.82,
  effects: {
    gradientTop: 0.1,
    gradientBottom: 0.28,
    highlightY: 0.16,
    highlightHeight: 0.2,
    highlightStrength: 0.36,
  },
  shadowStrength: 0,
  activeRegion: 0,
  presets: [],
  currentPresetId: null,
  currentAssetId: null,
};

let els = {};

function getMaskCanvas() {
  if (
    (state.maskMode === 'auto' ||
      state.maskMode === 'image' ||
      state.maskMode === 'polygon') &&
    state.maskCanvas
  ) {
    return state.maskCanvas;
  }
  if (!state.frameImage) return null;
  const w = state.frameImage.naturalWidth;
  const h = state.frameImage.naturalHeight;
  return buildMaskFromRegions(w, h, state.regions);
}

function draw() {
  if (!state.frameImage && !state.sourceImage) {
    const ctx = els.preview?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, els.preview.width, els.preview.height);
    return;
  }

  const mask = getMaskCanvas();
  if (!mask) return;

  const useRecolor =
    state.sourceImage &&
    (state.maskMode === 'auto' || state.maskMode === 'polygon');

  if (useRecolor) {
    renderAutoRecolor(els.preview, {
      sourceImage: state.sourceImage,
      maskCanvas: mask,
      lensColor: state.lensColor,
      lensOpacity: state.lensOpacity,
      effects: state.effects,
      shadowStrength: state.shadowStrength,
      maskOnly: state.maskMode === 'polygon',
    });
  } else {
    renderComposite(els.preview, {
      backLayer: state.backImage,
      frameLayer: state.frameImage,
      maskCanvas: mask,
      lensColor: state.lensColor,
      lensOpacity: state.lensOpacity,
      effects: state.effects,
      shadowStrength: state.shadowStrength,
    });
  }

  drawRegionOverlay();
}

function drawRegionOverlay() {
  const overlay = els.overlay;
  if (!overlay) return;
  overlay.innerHTML = '';
  if (state.maskMode !== 'regions' || !state.frameImage) {
    overlay.classList.add('hidden');
    return;
  }
  overlay.classList.remove('hidden');
  state.regions.forEach((region, index) => {
    const box = document.createElement('div');
    box.className = 'lens-region' + (index === state.activeRegion ? ' active' : '');
    box.style.left = `${region.x - region.w / 2}%`;
    box.style.top = `${region.y - region.h / 2}%`;
    box.style.width = `${region.w}%`;
    box.style.height = `${region.h}%`;
    box.style.transform = `rotate(${region.rotation ?? 0}deg)`;
    overlay.appendChild(box);
  });
}

async function applyAutoMaskFromSource(source) {
  const { maskCanvas, frameImage, backImage } = await buildFromSourceImage(source);
  state.sourceImage = source;
  state.maskCanvas = maskCanvas;
  state.frameImage = frameImage;
  state.backImage = backImage;
  state.maskMode = 'auto';
  if (els.maskMode) els.maskMode.value = 'auto';
}

async function loadLibraryAsset(assetId) {
  const asset = await getAsset(assetId);
  if (!asset) return;
  state.currentAssetId = assetId;
  if (els.assetSelect) els.assetSelect.value = assetId;
  if (els.presetName) els.presetName.value = asset.name;

  if (!asset.maskConfig) {
    state.sourceImage = await loadImage(asset.sourceDataUrl);
    await applyAutoMaskFromSource(state.sourceImage);
    draw();
    return;
  }

  const layers = await loadAssetForRendering(asset);
  state.sourceImage = layers.sourceImage;
  state.maskCanvas = layers.maskCanvas;
  state.frameImage = layers.frameImage;
  state.backImage = layers.backImage;
  state.maskMode = 'polygon';
  if (els.maskMode) els.maskMode.value = 'polygon';
  draw();
}

async function refreshAssetList() {
  if (!els.assetSelect) return;
  const assets = await listAssets();
  const ready = assets.filter((a) => a.status === 'ready');
  els.assetSelect.innerHTML =
    '<option value="">— Library asset —</option>' +
    ready
      .map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`)
      .join('');
  if (state.currentAssetId) els.assetSelect.value = state.currentAssetId;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function syncColorInputs() {
  const hex = state.lensColor.startsWith('#') ? state.lensColor : `#${state.lensColor}`;
  if (els.hexInput) els.hexInput.value = hex;
  if (els.colorPicker) els.colorPicker.value = hex;
}

function expandShortHex(hex) {
  const h = hex.slice(1);
  return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
}

async function loadReferenceDemoView(key) {
  const demo = await loadReferenceDemo(key);
  state.currentAssetId = null;
  state.sourceImage = demo.sourceImage;
  state.maskCanvas = demo.maskCanvas;
  state.frameImage = demo.frameImage;
  state.backImage = demo.backImage;
  state.maskMode = 'auto';
  if (els.maskMode) els.maskMode.value = 'auto';
  if (els.presetName) els.presetName.value = demo.name;
  state.lensColor = demo.lensColor;
  state.lensOpacity = demo.lensOpacity;
  state.shadowStrength = demo.shadowStrength;
  state.effects = { ...demo.effects };
  syncColorInputs();
  if (els.opacity) els.opacity.value = state.lensOpacity;
  if (els.opacityVal)
    els.opacityVal.textContent = Math.round(state.lensOpacity * 100) + '%';
  setActiveDemoButton(key);
  draw();
}

function setActiveDemoButton(key) {
  els.loadFrontRef?.classList.toggle('active-demo', key === 'front');
  els.loadSideRef?.classList.toggle('active-demo', key === 'side');
}

function bindRenderEvents() {
  const onLensColorChange = (hex) => {
    state.lensColor = hex;
    if (els.hexInput) els.hexInput.value = hex;
    if (els.colorPicker) els.colorPicker.value = hex.length === 4 ? expandShortHex(hex) : hex;
    draw();
  };

  els.hexInput?.addEventListener('input', () => {
    let v = els.hexInput.value.trim();
    if (!v.startsWith('#')) v = `#${v}`;
    if (/^#[0-9A-Fa-f]{3,8}$/.test(v) && v.length >= 4) {
      onLensColorChange(v.length === 4 ? expandShortHex(v) : v.slice(0, 7));
    }
  });

  els.colorPicker?.addEventListener('input', () => onLensColorChange(els.colorPicker.value));
  els.opacity?.addEventListener('input', () => {
    state.lensOpacity = Number(els.opacity.value);
    if (els.opacityVal) els.opacityVal.textContent = Math.round(state.lensOpacity * 100) + '%';
    draw();
  });

  els.assetSelect?.addEventListener('change', () => {
    if (els.assetSelect.value) loadLibraryAsset(els.assetSelect.value);
  });

  els.frameUpload?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      state.currentAssetId = null;
      await applyAutoMaskFromSource(await imageFromFile(file));
      draw();
    }
    e.target.value = '';
  });

  els.maskMode?.addEventListener('change', async () => {
    state.maskMode = els.maskMode.value;
    if (state.maskMode === 'auto' && state.sourceImage) {
      state.maskCanvas = detectLensMask(state.sourceImage);
    }
    draw();
  });

  els.loadFrontRef?.addEventListener('click', () => loadReferenceDemoView('front'));
  els.loadSideRef?.addEventListener('click', () => loadReferenceDemoView('side'));

  els.downloadPng?.addEventListener('click', () => {
    if (!els.preview) return;
    const link = document.createElement('a');
    link.download = `sunglasses-${state.lensColor.replace('#', '')}.png`;
    link.href = els.preview.toDataURL('image/png');
    link.click();
  });

  [
    ['gradientTop', 'gradientTop'],
    ['gradientBottom', 'gradientBottom'],
    ['highlightStrength', 'highlightStrength'],
    ['shadowStrength', 'shadowStrength'],
  ].forEach(([key, id]) => {
    els[id]?.addEventListener('input', () => {
      if (id === 'shadowStrength') state.shadowStrength = Number(els[id].value);
      else state.effects[id] = Number(els[id].value);
      draw();
    });
  });
}

/**
 * @param {HTMLElement} root
 * @param {{ assetId?: string }} params
 */
export async function mountRenderPage(root, params) {
  root.innerHTML = `
    <main class="layout">
      <section class="panel controls">
        <h2>Library assets</h2>
        <p class="hint">Assets with a saved polygon mask appear here. <a href="#/admin">Manage assets</a></p>
        <label class="field">
          <span>Masked asset</span>
          <select id="asset-select"></select>
        </label>
        <label class="field">
          <span>Quick upload (auto-mask)</span>
          <input id="frame-upload" type="file" accept="image/png,image/webp,image/jpeg" />
        </label>
        <label class="field">
          <span>Mask mode</span>
          <select id="mask-mode">
            <option value="polygon">Polygon mask (library)</option>
            <option value="auto" selected>Auto-detect</option>
            <option value="regions">Manual regions</option>
          </select>
        </label>
        <p class="hint demo-hint">Demo references:</p>
        <div class="row-btns demo-ref-btns">
          <button type="button" id="load-front-ref" class="btn ghost active-demo">Front reference</button>
          <button type="button" id="load-side-ref" class="btn ghost">45° side</button>
        </div>
        <h2>Lens color</h2>
        <div class="color-row">
          <input id="color-picker" type="color" value="#3a3a3e" />
          <input id="hex-input" type="text" value="#3a3a3e" maxlength="7" />
        </div>
        <label class="field range">
          <span>Opacity <em id="opacity-val">82%</em></span>
          <input id="opacity" type="range" min="0.2" max="0.95" step="0.01" value="0.82" />
        </label>
        <h2>Lens effects</h2>
        <label class="field range"><span>Top gradient</span><input id="gradient-top" type="range" min="0" max="0.4" step="0.01" value="0.1" /></label>
        <label class="field range"><span>Bottom depth</span><input id="gradient-bottom" type="range" min="0" max="0.5" step="0.01" value="0.28" /></label>
        <label class="field range"><span>Highlight</span><input id="highlight-strength" type="range" min="0" max="0.7" step="0.01" value="0.36" /></label>
        <label class="field range"><span>Shadow</span><input id="shadow-strength" type="range" min="0" max="0.35" step="0.01" value="0" /></label>
        <button type="button" id="download-png" class="btn primary full">Download PNG</button>
      </section>
      <section class="panel preview-panel">
        <div class="preview-wrap">
          <canvas id="preview"></canvas>
          <div id="region-overlay" class="region-overlay hidden"></div>
        </div>
        <p class="preview-caption">Polygon-masked assets recolor lenses only; frame stays original.</p>
      </section>
    </main>
  `;

  els = {
    preview: root.querySelector('#preview'),
    overlay: root.querySelector('#region-overlay'),
    hexInput: root.querySelector('#hex-input'),
    colorPicker: root.querySelector('#color-picker'),
    opacity: root.querySelector('#opacity'),
    opacityVal: root.querySelector('#opacity-val'),
    frameUpload: root.querySelector('#frame-upload'),
    maskMode: root.querySelector('#mask-mode'),
    assetSelect: root.querySelector('#asset-select'),
    downloadPng: root.querySelector('#download-png'),
    loadFrontRef: root.querySelector('#load-front-ref'),
    loadSideRef: root.querySelector('#load-side-ref'),
    gradientTop: root.querySelector('#gradient-top'),
    gradientBottom: root.querySelector('#gradient-bottom'),
    highlightStrength: root.querySelector('#highlight-strength'),
    shadowStrength: root.querySelector('#shadow-strength'),
    presetName: null,
  };

  bindRenderEvents();
  await refreshAssetList();
  syncColorInputs();

  if (params.assetId) {
    await loadLibraryAsset(params.assetId);
  } else {
    await loadReferenceDemoView('front');
  }
}
