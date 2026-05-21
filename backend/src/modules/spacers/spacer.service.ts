import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import type { CreateSpacerDTO, UpdateSpacerDTO } from "./spacer.validation.js";

type Specs = Record<string, unknown>;

function mergeSpecs(existing: unknown, patch: Specs): Specs {
  const base =
    existing !== null && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Specs) }
      : {};
  return { ...base, ...patch };
}

function mapSpacerRow(row: Record<string, unknown>): Record<string, unknown> {
  const specs = mergeSpecs(row.specs, {});
  const legacyImage = typeof specs.legacy_image_url === "string" ? specs.legacy_image_url : "";

  return {
    id: row.public_id,
    name: row.name,
    price: Number(row.unit_price),
    image: legacyImage,
    type: row.spacer_type_id ?? undefined,
    description: row.description ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SpacerService {
  async list(): Promise<unknown[]> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("spacers")
      .select("*")
      .order("display_order", { ascending: true })
      .order("public_id", { ascending: true });
    assertNoDbError(error);
    return (data ?? []).map((row) => mapSpacerRow(row as Record<string, unknown>));
  }

  async getByClientId(clientId: string): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase.from("spacers").select("*").eq("public_id", clientId).maybeSingle();
    assertNoDbError(error);
    if (!data) throw new NotFoundError("Spacer not found");
    return mapSpacerRow(data as Record<string, unknown>);
  }

  async create(payload: CreateSpacerDTO): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const specs: Specs = payload.image?.trim() ? { legacy_image_url: payload.image.trim() } : {};

    const { data, error } = await supabase
      .from("spacers")
      .insert({
        public_id: payload.id.trim(),
        name: payload.name.trim(),
        unit_price: payload.price,
        currency_code: "USD",
        description: payload.description?.trim() ?? "",
        spacer_type_id: payload.type ?? null,
        specs,
        display_order: 0,
        is_active: true,
      })
      .select("*")
      .single();

    if (error?.code === "23505") throw new ConflictError("Spacer id already exists");
    assertNoDbError(error);
    return mapSpacerRow(data as Record<string, unknown>);
  }

  async update(clientId: string, payload: UpdateSpacerDTO): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const { data: existing, error: loadErr } = await supabase.from("spacers").select("*").eq("public_id", clientId).maybeSingle();
    assertNoDbError(loadErr);
    if (!existing) throw new NotFoundError("Spacer not found");

    const row = existing as Record<string, unknown>;
    let specs = mergeSpecs(row.specs, {});
    if (payload.image !== undefined) {
      specs = mergeSpecs(specs, payload.image.trim() ? { legacy_image_url: payload.image.trim() } : { legacy_image_url: "" });
    }

    const updates: Record<string, unknown> = {
      ...(payload.name !== undefined && { name: payload.name.trim() }),
      ...(payload.price !== undefined && { unit_price: payload.price }),
      ...(payload.description !== undefined && { description: payload.description.trim() }),
      ...(payload.type !== undefined && { spacer_type_id: payload.type }),
      specs,
    };

    const { data, error } = await supabase
      .from("spacers")
      .update(updates)
      .eq("public_id", clientId)
      .select("*")
      .single();
    assertNoDbError(error);
    return mapSpacerRow(data as Record<string, unknown>);
  }

  async remove(clientId: string): Promise<{ message: string }> {
    await this.getByClientId(clientId);
    const supabase = getSupabaseServiceRole();
    const { error } = await supabase.from("spacers").delete().eq("public_id", clientId);
    assertNoDbError(error);
    return { message: "Spacer removed" };
  }
}

export const spacerService = new SpacerService();
