import { navigate, getEditorPath, getRenderPath } from '../router.js';
import { createAssetFromFile, deleteAsset, listAssets } from '../storage/assetStore.js';

/**
 * @param {HTMLElement} root
 */
export async function mountAdminPage(root) {
  const assets = await listAssets();

  root.innerHTML = `
    <div class="page-admin">
      <div class="page-head">
        <div>
          <h1>Asset library</h1>
          <p>Upload sunglasses images, define lens masks, then use them in the renderer.</p>
        </div>
        <label class="btn primary upload-btn">
          Upload frame image
          <input type="file" id="admin-upload" accept="image/png,image/webp,image/jpeg" hidden />
        </label>
      </div>
      <div class="asset-table-wrap panel">
        <table class="asset-table">
          <thead>
            <tr>
              <th>Preview</th>
              <th>Name</th>
              <th>Size</th>
              <th>Mask</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="asset-rows"></tbody>
        </table>
      </div>
    </div>
  `;

  const tbody = root.querySelector('#asset-rows');

  function renderRows(list) {
    if (!list.length) {
      tbody.innerHTML =
        '<tr><td colspan="6" class="empty">No assets yet. Upload an image to start masking.</td></tr>';
      return;
    }
    tbody.innerHTML = list
      .map(
        (a) => `
      <tr data-id="${a.id}">
        <td><img class="asset-thumb" src="${a.sourceDataUrl}" alt="" /></td>
        <td><strong>${escapeHtml(a.name)}</strong></td>
        <td>${a.width}×${a.height}</td>
        <td>${a.maskConfig ? `${a.maskConfig.lenses.length} lens polygon(s)` : '—'}</td>
        <td><span class="badge badge-${a.status}">${a.status}</span></td>
        <td class="actions">
          <button type="button" class="btn ghost btn-sm" data-action="mask">Edit mask</button>
          <button type="button" class="btn ghost btn-sm" data-action="render" ${
            a.status !== 'ready' ? 'disabled' : ''
          }>Render</button>
          <button type="button" class="btn ghost btn-sm danger" data-action="delete">Delete</button>
        </td>
      </tr>
    `,
      )
      .join('');
  }

  renderRows(assets);

  root.querySelector('#admin-upload').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const asset = await createAssetFromFile(file);
    e.target.value = '';
    navigate(getEditorPath(asset.id));
  });

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const row = btn.closest('tr[data-id]');
    if (!row) return;
    const id = row.dataset.id;
    const action = btn.dataset.action;

    if (action === 'mask') navigate(getEditorPath(id));
    if (action === 'render') navigate(getRenderPath(id));
    if (action === 'delete') {
      if (!confirm('Delete this asset and its mask configuration?')) return;
      await deleteAsset(id);
      renderRows(await listAssets());
    }
  });
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
