export type { CrystalEntry } from "@/data/crystals";
export type { FrameEntry, LensColor } from "@/data/glasses";

export interface CharmEntry {
  id: string;
  name: string;
  price: number;
  image: string;
  type?: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SpacerEntry {
  id: string;
  name: string;
  price: number;
  image: string;
  type?: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Crystal taxonomy row from `crystal_types` (API returns UUID `id`). */
export interface TypeEntry {
  id: string;
  name: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CharmTypeEntry {
  id: string;
  name: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SpacerTypeEntry {
  id: string;
  name: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}
