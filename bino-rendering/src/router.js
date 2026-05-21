/**
 * Lightweight hash router: #/render | #/admin | #/editor/:id
 */

const routes = [];

/** @param {RegExp} regex @param {(params: Record<string, string>) => void} handler */
export function route(regex, handler) {
  routes.push({ regex, handler });
}

export function navigate(path) {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
}

export function getEditorPath(assetId) {
  return `#/editor/${assetId}`;
}

export function getRenderPath(assetId) {
  return assetId ? `#/render?asset=${encodeURIComponent(assetId)}` : '#/render';
}

function parseHash() {
  const raw = (window.location.hash || '#/render').replace(/^#/, '');
  const [pathname, query = ''] = raw.split('?');
  const search = new URLSearchParams(query);
  return { pathname: pathname || '/render', search };
}

export function startRouter() {
  const run = () => {
    const { pathname, search } = parseHash();
    for (const { regex, handler } of routes) {
      const m = pathname.match(regex);
      if (!m) continue;
      const params = { assetId: search.get('asset') ?? '' };
      if (m[1]) params.id = m[1];
      handler(params);
      return;
    }
    navigate('/render');
  };
  window.addEventListener('hashchange', run);
  run();
}
