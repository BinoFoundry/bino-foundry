import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { NotFoundError } from "../../lib/errors.js";

export interface BeadAvailabilityStatusRow {
  code: string;
  label: string;
  description: string;
  showInBuilder: boolean;
  allowNewDesigns: boolean;
  displayOrder: number;
}

function mapRow(row: Record<string, unknown>): BeadAvailabilityStatusRow {
  return {
    code: String(row.code),
    label: String(row.label),
    description: String(row.description ?? ""),
    showInBuilder: row.show_in_builder === true,
    allowNewDesigns: row.allow_new_designs === true,
    displayOrder: Number(row.display_order ?? 0),
  };
}

export class BeadAvailabilityStatusService {
  async list(): Promise<BeadAvailabilityStatusRow[]> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("bead_availability_statuses")
      .select("code, label, description, show_in_builder, allow_new_designs, display_order")
      .order("display_order", { ascending: true })
      .order("code", { ascending: true });

    assertNoDbError(error);
    return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  }

  async getByCode(code: string): Promise<BeadAvailabilityStatusRow> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("bead_availability_statuses")
      .select("code, label, description, show_in_builder, allow_new_designs, display_order")
      .eq("code", code)
      .maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError(`Unknown bead availability status: ${code}`);
    return mapRow(data as Record<string, unknown>);
  }
}

export const beadAvailabilityStatusService = new BeadAvailabilityStatusService();
