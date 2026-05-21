import { route, startRouter } from './router.js';
import { mountAdminPage } from './pages/adminPage.js';
import { mountEditorPage } from './pages/editorPage.js';
import { mountRenderPage } from './pages/renderPage.js';

const app = document.getElementById('app');
/** @type {(() => void) | null} */
let pageCleanup = null;

async function showPage(mountFn, params = {}) {
  pageCleanup?.();
  pageCleanup = null;
  app.innerHTML = '<p class="loading">Loading…</p>';
  const result = await mountFn(app, params);
  if (typeof result === 'function') pageCleanup = result;
}

function setNavActive() {
  const { pathname } = parseLocation();
  document.querySelectorAll('[data-nav]').forEach((el) => {
    const nav = el.getAttribute('data-nav');
    const active =
      (nav === 'render' && pathname.startsWith('/render')) ||
      (nav === 'admin' && pathname.startsWith('/admin')) ||
      (nav === 'editor' && pathname.startsWith('/editor'));
    el.classList.toggle('nav-active', active);
  });
}

function parseLocation() {
  const raw = (window.location.hash || '#/render').replace(/^#/, '');
  const [pathname, query = ''] = raw.split('?');
  return { pathname: pathname || '/render', search: new URLSearchParams(query) };
}

route(/^\/admin$/, async () => {
  setNavActive();
  await showPage(mountAdminPage);
});

route(/^\/editor\/([^/]+)$/, async (params) => {
  setNavActive();
  await showPage(mountEditorPage, { id: params.id });
});

route(/^\/render$/, async (params) => {
  setNavActive();
  await showPage(mountRenderPage, { assetId: params.assetId || '' });
});

startRouter();
setNavActive();
window.addEventListener('hashchange', setNavActive);
