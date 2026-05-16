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

import { DEFAULT_CRYSTALS } from "@/data/crystals";
import { DEFAULT_FRAMES, type FrameEntry } from "@/data/glasses";
import { getCatalogueSnapshot } from "@/data/index";

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
    return { crystals: DEFAULT_CRYSTALS, frames: DEFAULT_FRAMES };
  }
  return getCatalogueSnapshot();
}

export const CRYSTAL_LIBRARY: CrystalEntry[] = snapshot().crystals;

export const ZODIAC_ANIMALS: string[] = [
  "Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake",
  "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig",
];

// ── Business-logic helpers (unchanged) ───────────────────────────────────────

export type BeadSize = 6 | 8 | 10;
export type ItemType = "crystal" | "charm" | "spacer";

export interface CharmItem {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
}

export interface SpacerItem {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
}

export interface PlacedBead {
  position: number;
  type: ItemType;
  crystal?: CrystalEntry;
  charm?: CharmItem;
  spacer?: SpacerItem;
  beadSize: BeadSize;
}

export const CHARM_LIBRARY: CharmItem[] = [
  { id: "charm-evil-eye", name: "Evil Eye", price: 8.00, image: "", description: "Protection charm with classic evil eye motif" },
  { id: "charm-hamsa", name: "Hamsa Hand", price: 9.50, image: "", description: "Hand of Fatima for good fortune" },
  { id: "charm-lotus", name: "Lotus Flower", price: 7.50, image: "", description: "Symbol of purity and spiritual growth" },
  { id: "charm-moon", name: "Crescent Moon", price: 6.50, image: "", description: "Celestial crescent moon pendant" },
  { id: "charm-star", name: "North Star", price: 6.50, image: "", description: "Guiding star charm for direction" },
  { id: "charm-heart", name: "Heart", price: 5.50, image: "", description: "Classic heart charm" },
  { id: "charm-butterfly", name: "Butterfly", price: 8.50, image: "", description: "Delicate butterfly symbolizing transformation" },
  { id: "charm-tree", name: "Tree of Life", price: 10.00, image: "", description: "Sacred tree representing growth and connection" },
];

export const SPACER_LIBRARY: SpacerItem[] = [
  { id: "spacer-gold-round", name: "Gold Round", price: 2.00, image: "", description: "Polished gold-tone round spacer" },
  { id: "spacer-silver-round", name: "Silver Round", price: 2.00, image: "", description: "Polished silver-tone round spacer" },
  { id: "spacer-gold-flat", name: "Gold Flat Disc", price: 2.50, image: "", description: "Flat gold-tone disc spacer" },
  { id: "spacer-silver-flat", name: "Silver Flat Disc", price: 2.50, image: "", description: "Flat silver-tone disc spacer" },
  { id: "spacer-rhinestone", name: "Rhinestone Ring", price: 3.50, image: "", description: "Crystal-studded ring spacer" },
  { id: "spacer-rondelle-gold", name: "Gold Rondelle", price: 3.00, image: "", description: "Textured gold-tone rondelle spacer" },
  { id: "spacer-rondelle-silver", name: "Silver Rondelle", price: 3.00, image: "", description: "Textured silver-tone rondelle spacer" },
];

export function calculateBeadPrice(basePrice: number, beadSize: BeadSize): number {
  const multiplier = beadSize === 6 ? 0.8 : beadSize === 8 ? 1.0 : 1.3;
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


