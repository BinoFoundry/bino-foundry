/** Global bracelet bead diameter option (admin-managed). */
export interface BeadSizeEntry {
  id: string;
  sizeMm: number;
  label: string;
  displayOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
  /** Largest visible crop diameter in this mm group (px). */
  groupReferenceDiameterPx?: number | null;
  createdAt?: string;
  updatedAt?: string;
}
