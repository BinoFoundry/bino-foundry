import { createMaskConfig, defaultLensSet, isMaskConfigValid, migrateAnchors } from '../mask/types.js';

const DB_NAME = 'bino-rendering-db';
const DB_VERSION = 1;
const STORE = 'assets';

/** @typedef {{
 *   id: string,
 *   name: string,
 *   sourceDataUrl: string,
 *   width: number,
 *   height: number,
 *   maskConfig: import('../mask/types.js').MaskConfig | null,
 *   status: 'draft' | 'ready',
 *   createdAt: number,
 *   updatedAt: number
 * }} AssetRecord */

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * @returns {Promise<AssetRecord[]>}
 */
export async function listAssets() {
  return withStore('readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        items.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * @param {string} id
 * @returns {Promise<AssetRecord | null>}
 */
export async function getAsset(id) {
  return withStore('readonly', (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  });
}

/**
 * @param {AssetRecord} asset
 */
export async function putAsset(asset) {
  asset.updatedAt = Date.now();
  return withStore('readwrite', (store) => {
    store.put(asset);
  });
}

/**
 * @param {string} id
 */
export async function deleteAsset(id) {
  return withStore('readwrite', (store) => {
    store.delete(id);
  });
}

/**
 * Create asset from uploaded file; redirects to editor for masking.
 * @param {File} file
 * @param {string} [name]
 */
export async function createAssetFromFile(file, name) {
  const { dataUrl, width, height } = await fileToDataUrl(file);
  const id = crypto.randomUUID();
  const asset = {
    id,
    name: name?.trim() || file.name.replace(/\.[^.]+$/, '') || 'Untitled frame',
    sourceDataUrl: dataUrl,
    width,
    height,
    maskConfig: null,
    status: 'draft',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await putAsset(asset);
  return asset;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve({
        dataUrl: canvas.toDataURL('image/png'),
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Save polygon mask config; marks asset ready for renderer when valid.
 * @param {string} id
 * @param {import('../mask/types.js').MaskConfig} maskConfig
 */
export async function saveAssetMaskConfig(id, maskConfig) {
  const asset = await getAsset(id);
  if (!asset) throw new Error('Asset not found');
  asset.maskConfig = maskConfig;
  asset.status = isMaskConfigValid(maskConfig) ? 'ready' : 'draft';
  asset.width = maskConfig.imageWidth;
  asset.height = maskConfig.imageHeight;
  await putAsset(asset);
  return asset;
}

/**
 * Initialize empty lens slots for editor.
 * @param {AssetRecord} asset
 */
export function getInitialLensesForEditor(asset) {
  if (asset.maskConfig?.lenses?.length) {
    return asset.maskConfig.lenses.map((l) => ({
      id: l.id,
      label: l.label,
      points: migrateAnchors(l.points).map((p) => ({
        ...p,
        handleIn: p.handleIn ? { ...p.handleIn } : null,
        handleOut: p.handleOut ? { ...p.handleOut } : null,
      })),
    }));
  }
  return defaultLensSet();
}

export { isMaskConfigValid, createMaskConfig };
