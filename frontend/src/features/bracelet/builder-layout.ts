/**
 * Bracelet builder column proportions — responsive min/max, not fixed pixel layouts.
 * Center canvas uses flex-1 and shrinks automatically when sidebars widen.
 */

/** Laptop docked library (~10% wider than prior min(188px, 22vw)). */
export const BEAD_LIBRARY_SIDEBAR_CLASS_LAPTOP = "w-[min(208px,24vw)]";

/** Wide desktop docked library (~10% wider than prior min(220px, 20vw)). */
export const BEAD_LIBRARY_SIDEBAR_CLASS_WIDE = "w-[min(244px,22vw)]";

/** Tablet slide-over drawer (~10% wider than prior 300px / 320px cap). */
export const BEAD_LIBRARY_DRAWER_CLASS =
  "w-[min(330px,88vw)] max-w-[352px] sm:max-w-[352px]";

export function beadLibrarySidebarWidthClass(isWideDesktop: boolean): string {
  return isWideDesktop ? BEAD_LIBRARY_SIDEBAR_CLASS_WIDE : BEAD_LIBRARY_SIDEBAR_CLASS_LAPTOP;
}
