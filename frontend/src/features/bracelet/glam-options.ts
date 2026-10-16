/**
 * "Glam it up" — optional gold finishing tiers offered at the order step.
 *
 * These are a curated, flat-priced add-on (customer picks one or none). The
 * exact pieces are confirmed when they DM to order, so the builder does not
 * render them on the strand — each tier is represented by a product photo.
 */
export interface GlamOption {
  id: string;
  name: string;
  price: number;
  /** Product photo URL for the option card. */
  image: string;
  description: string;
}

const ASSET_BASE =
  "https://sbptjmqhgwbadcoqksdm.supabase.co/storage/v1/object/public/assets/ui/admin/bino-foundry";

export const GLAM_OPTIONS: GlamOption[] = [
  {
    id: "dainty",
    name: "Dainty",
    price: 28,
    image: `${ASSET_BASE}/glam-399377e4-a0d2-4587-9735-04a6a38b461e.png`,
    description: "Delicate gold spacers threaded between your crystals.",
  },
  {
    id: "luxe",
    name: "Luxe",
    price: 58,
    image: `${ASSET_BASE}/glam-c047a014-6be2-42ff-863f-9f789d68d5ab.png`,
    description: "Gold bead caps with round spacers for a refined, elevated finish.",
  },
  {
    id: "signature",
    name: "Signature",
    price: 88,
    image: `${ASSET_BASE}/glam-c628705c-aa12-4c68-a444-830ff21a6b55.png`,
    description: "Our fullest look, with capped beads, floral spacers and gold accents.",
  },
];

export function glamOptionById(id: string | null | undefined): GlamOption | null {
  if (!id) return null;
  return GLAM_OPTIONS.find((o) => o.id === id) ?? null;
}
