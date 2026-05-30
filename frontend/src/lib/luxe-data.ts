/**
 * luxe-data.ts
 *
 * This file re-exports everything that the rest of the app uses, but now
 * sources its data from the `src/data/` registry layer so that crystals
 * and frames are managed in one place (with localStorage persistence
 * via `useCatalogue()`).
 *
 * The type names and all function signatures remain exactly the same so no
 * other component needs to change.
 */

// ── Types ────────────────────────────────────────────────────────────────────

import { DEFAULT_BRACELET_PRICING_RULES } from "@bino-foundry/shared/types";

import { calculateUnitPrice } from "@/features/bracelet/pricing";
import { DEFAULT_CRYSTALS } from "@/data/crystals";
import { DEFAULT_FRAMES, type FrameEntry } from "@/data/glasses";
import { getCatalogueSnapshot } from "@/data/index";
import type { BeadLibraryEntry } from "@/types/beads";

// Re-export entry types under the legacy names used across the app
export type { CrystalEntry as CrystalBead } from "@/data/crystals";

// Provide CrystalBead as inline aliases too
// (some files import them individually)
import type { CrystalEntry } from "@/data/crystals";

export type CrystalBeadAlias = CrystalEntry;

// ── Static catalogue snapshots (read at module load time) ────────────────────
// Used by components that don't use the hook (legacy consumers).
// After any admin edit they should re-render via the hook, but these keep
// backward-compat for any static/non-hook imports.

/**
 * Returns the current catalogue snapshot (defaults merged with localStorage).
 * Falls back to the compile-time defaults if localStorage is unavailable.
 */
function snapshot() {
  if (typeof window === "undefined") {
    return { beadLibraries: DEFAULT_CRYSTALS, beadTypes: [], frames: DEFAULT_FRAMES };
  }
  return getCatalogueSnapshot();
}

export const CRYSTAL_LIBRARY: CrystalEntry[] = snapshot().beadLibraries as unknown as CrystalEntry[];

export const ZODIAC_ANIMALS: string[] = [
  "Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake",
  "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig",
];

// ── Business-logic helpers ───────────────────────────────────────────────────

/** Bead diameter in millimeters (options come from `bead_sizes` table). */
export type BeadSize = number;

/** @deprecated Use beadTypeSlug on BeadLibraryEntry */
export type ItemType = string;

/** Unified placed bead on the strand. */
export interface PlacedBead {
  position: number;
  bead: BeadLibraryEntry;
  beadSize: BeadSize;
}

export function getPlacedBeadPrice(item: PlacedBead): number {
  return calculateUnitPrice(item.bead, item.beadSize, DEFAULT_BRACELET_PRICING_RULES);
}

export function calculateBeadPrice(
  basePrice: number,
  beadSize: BeadSize,
  multiplier = 1,
): number {
  return basePrice * multiplier;
}

export function calculateBeadCount(wristSizeCm: number, beadSizeMm: number): number {
  const beadCount = Math.round((wristSizeCm * 10) / beadSizeMm);
  return Math.max(beadCount, 8);
}

// ── Sunglasses types & data (unchanged) ─────────────────────────────────────

export interface SunglassesConfig {
  frame: string;
  tintDensity: number;
  lensColor: string;
  lensGradient: string;
}

export type FrameOption = FrameEntry;

export const FRAME_OPTIONS: FrameOption[] = snapshot().frames;

export const LENS_COLORS = [
  { id: "amber", name: "Amber", image: "" },
  { id: "american-grey-fade", name: "American Grey Fade", image: "" },
  { id: "aqua-sunrise", name: "Aqua Sunrise", image: "" },
  { id: "bel-air-blue", name: "Bel Air Blue", image: "" },
  { id: "big-apple-fade", name: "Big Apple Fade", image: "" },
  { id: "broadway-blue-fade", name: "Broadway Blue Fade", image: "" },
  { id: "cabernet", name: "Cabernet", image: "" },
  { id: "candy-corn", name: "Candy Corn", image: "" },
  { id: "celebrity-blue", name: "Celebrity Blue", image: "" },
  { id: "chestnut-fade", name: "Chestnut Fade", image: "" },
  { id: "city-lights", name: "City Lights", image: "" },
  { id: "denim-blue", name: "Denim Blue", image: "" },
  { id: "forest-wood", name: "Forest Wood", image: "" },
  { id: "g-15-fade", name: "G-15 Fade", image: "" },
  { id: "garnet-green", name: "Garnet Green", image: "" },
  { id: "lavender", name: "Lavender", image: "" },
  { id: "limelight", name: "Limelight", image: "" },
  { id: "mellow-yellow", name: "Mellow Yellow", image: "" },
  { id: "new-york-rose", name: "New York Rose", image: "" },
  { id: "pastel-yellow", name: "Pastel Yellow", image: "" },
  { id: "purple-nurple", name: "Purple Nurple", image: "" },
  { id: "root-beer-fade", name: "Root Beer Fade", image: "" },
  { id: "turquoise", name: "Turquoise", image: "" },
  { id: "woodstock-orange", name: "Woodstock Orange", image: "" },
];

export const FRAME_BASE_PRICE = 45;
export const COATING_PRICE_PER_10 = 2;


