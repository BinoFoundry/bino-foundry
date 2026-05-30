export interface SavedBraceletConfiguration {
  id: string;
  status: string;
  subtotal: number;
  currencyCode: string;
  itemCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBraceletConfigBody {
  twinning: boolean;
  wristSizeCmA: number;
  wristSizeCmB: number;
  defaultBeadSizeMm: number;
  status?: "draft" | "saved";
  items: {
    strandIndex: 0 | 1;
    slotPosition: number;
    beadLibraryId: string;
    beadSizeMm: number;
  }[];
}
