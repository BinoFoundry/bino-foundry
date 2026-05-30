export interface BeadSizeEntry {
  id: string;
  sizeMm: number;
  label: string;
  priceMultiplier: number;
  displayOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
