export interface CrystalEntry {
  id: string;        // Client side identifier
  _id?: string; // Same as `id` when echoed by older payloads (optional)
  name: string;
  price: number;
  image: string;
  type?: string;
  description: string;
}

const STATIC_CRYSTALS: CrystalEntry[] = [
  {
    id: "rose-quartz",
    name: "Rose Quartz",
    price: 3.50,
    image: "/beads/Rose_Quartz.png",
    type: "quartz",
    description: "The stone of universal love, promoting self-love and deep inner healing.",
  },
  {
    id: "blue-lace-agate",
    name: "Blue Lace Agate",
    price: 4.00,
    image: "/beads/Blue_Lace_Agate.png",
    type: "agate",
    description: "A calming stone that brings peace of mind and gentle communication.",
  },
  {
    id: "tigers-eye",
    name: "Tiger's Eye",
    price: 3.75,
    image: "/beads/Tigers_Eye.png",
    type: "quartz",
    description: "A stone of protection and grounding that sharpens focus and willpower.",
  },
];

export const DEFAULT_CRYSTALS: CrystalEntry[] = STATIC_CRYSTALS;
