/** Global bracelet bead diameter option (admin-managed). */
export interface BeadSizeEntry {
  id: string;
  sizeMm: number;
  label: string;
  displayOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
