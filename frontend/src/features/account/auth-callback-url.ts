/**
 * Absolute URL of the in-app auth callback page.
 *
 * Built from the Vite base path rather than `window.location.origin`, because
 * the app is mounted under /design in production: origin alone points at the
 * storefront, where this route does not exist.
 */
export function authCallbackUrl(
  origin: string = window.location.origin,
  basePath: string = import.meta.env.BASE_URL,
): string {
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  return new URL(`${base}auth/callback`, origin).toString();
}
