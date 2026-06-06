export interface WristSizeEntry {
  id: string;
  sizeCm: number;
  /** Customer-facing name (e.g. "Petite · 14 cm"). */
  label: string;
  notes?: string | null;
  displayOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
