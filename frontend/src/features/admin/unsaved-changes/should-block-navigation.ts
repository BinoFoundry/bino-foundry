/**
 * Whether the Admin unsaved-changes guard should block a route transition.
 *
 * Same-pathname search/hash updates (editor panels, list filters) are UI state,
 * not leaving the page — blocking those prevented upload→Crop URL updates.
 */
export function shouldBlockAdminNavigation(
  hasDirtySources: boolean,
  currentPathname: string,
  nextPathname: string,
): boolean {
  if (!hasDirtySources) return false;
  if (currentPathname === nextPathname) return false;
  return true;
}
