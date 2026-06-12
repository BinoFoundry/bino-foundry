import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { settingsService } from "../settings/settings.service.js";
import type { CreateCrystalDTO, UpdateCrystalDTO } from "./crystal.validation.js";

type Specs = Record<string, unknown>;

function mergeSpecs(existing: unknown, patch: Specs): Specs {
  const base =
    existing !== null && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Specs) }
      : {};
  return { ...base, ...patch };
}

function mapCrystalRow(row: Record<string, unknown>): Record<string, unknown> {
  const specs = mergeSpecs(row.specs, {});
  const legacyImage = typeof specs.legacy_image_url === "string" ? specs.legacy_image_url : "";

  return {
    id: row.public_id,
    name: row.name,
    price: Number(row.unit_price),
    image: legacyImage,
    type: row.crystal_type_id ?? undefined,
    description: row.description ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CrystalService {
  async list(): Promise<unknown[]> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("crystals")
      .select("*")
      .order("display_order", { ascending: true })
      .order("public_id", { ascending: true });

    assertNoDbError(error);
    return (data ?? []).map((row) => mapCrystalRow(row as Record<string, unknown>));
  }

  async getByClientId(clientId: string): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase.from("crystals").select("*").eq("public_id", clientId).maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Crystal not found");
    return mapCrystalRow(data as Record<string, unknown>);
  }

  async create(payload: CreateCrystalDTO): Promise<unknown> {
    const supabase = getSupabaseServiceRole();
    const { currencyCode } = await settingsService.getGeneralSettings();
    const specs: Specs = payload.image?.trim()
      ? { legacy_image_url: payload.image.trim() }
      : {};

    const insertRow = {
      public_id: payload.id.trim(),
      name: payload.name.trim(),
      unit_price: payload.price,
      currency_code: currencyCode,
      description: payload.description?.trim() ?? "",
      crystal_type_id: payload.type ?? null,
      specs,
      display_order: 0,
      is_active: true,
    };

    const { data, error } = await supabase.from("crystals").insert(insertRow).select("*").single();

    if (error?.code === "23505") {
      throw new ConflictError("Crystal id already exists");
    }
    assertNoDbError(error);

    return mapCrystalRow(data as Record<string, unknown>);
  }

  async update(clientId: string, payload: UpdateCrystalDTO): Promise<unknown> {
    const supabase = getSupabaseServiceRole();

    const { data: existing, error: loadErr } = await supabase.from("crystals").select("*").eq("public_id", clientId).maybeSingle();

    assertNoDbError(loadErr);
    if (!existing) throw new NotFoundError("Crystal not found");

    const row = existing as Record<string, unknown>;
    let specs = mergeSpecs(row.specs, {});
    if (payload.image !== undefined) {
      specs = mergeSpecs(specs, payload.image.trim() ? { legacy_image_url: payload.image.trim() } : { legacy_image_url: "" });
    }

    const updates: Record<string, unknown> = {
      ...(payload.name !== undefined && { name: payload.name.trim() }),
      ...(payload.price !== undefined && { unit_price: payload.price }),
      ...(payload.description !== undefined && { description: payload.description.trim() }),
      ...(payload.type !== undefined && { crystal_type_id: payload.type }),
      specs,
    };

    const { data, error } = await supabase.from("crystals").update(updates).eq("public_id", clientId).select("*").single();

    assertNoDbError(error);
    return mapCrystalRow(data as Record<string, unknown>);
  }

  async remove(clientId: string): Promise<{ message: string }> {
    await this.getByClientId(clientId);

    const supabase = getSupabaseServiceRole();
    const { error } = await supabase.from("crystals").delete().eq("public_id", clientId);

    assertNoDbError(error);
    return { message: "Crystal removed" };
  }
}

export const crystalService = new CrystalService();
