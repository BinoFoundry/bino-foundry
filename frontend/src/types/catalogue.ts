export type { CrystalEntry } from "@/data/crystals";
export type { FrameEntry, LensColor } from "@/data/glasses";

/** Crystal taxonomy row from `crystal_types` (API returns UUID `id`). */
export interface TypeEntry {
  id: string;
  name: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}
