import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { NotFoundError } from "../../lib/errors.js";

export interface CatalogAvailabilityStatusRow {
  code: string;
  label: string;
  description: string;
  showInBuilder: boolean;
  allowNewDesigns: boolean;
  displayOrder: number;
}

function mapRow(row: Record<string, unknown>): CatalogAvailabilityStatusRow {
  return {
    code: String(row.code),
    label: String(row.label),
    description: String(row.description ?? ""),
    showInBuilder: row.show_in_builder === true,
    allowNewDesigns: row.allow_new_designs === true,
    displayOrder: Number(row.display_order ?? 0),
  };
}

/** @deprecated Use CatalogAvailabilityStatusService */
export type BeadAvailabilityStatusRow = CatalogAvailabilityStatusRow;

export class CatalogAvailabilityStatusService {
  async list(): Promise<CatalogAvailabilityStatusRow[]> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("catalog_availability_statuses")
      .select("code, label, description, show_in_builder, allow_new_designs, display_order")
      .order("display_order", { ascending: true })
      .order("code", { ascending: true });

    assertNoDbError(error);
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async getByCode(code: string): Promise<CatalogAvailabilityStatusRow> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("catalog_availability_statuses")
      .select("code, label, description, show_in_builder, allow_new_designs, display_order")
      .eq("code", code)
      .maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError(`Unknown catalog availability status: ${code}`);
    return mapRow(data as Record<string, unknown>);
  }
}

/** @deprecated Use catalogAvailabilityStatusService */
export const beadAvailabilityStatusService = new CatalogAvailabilityStatusService();
export const catalogAvailabilityStatusService = beadAvailabilityStatusService;
