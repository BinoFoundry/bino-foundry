import { randomBytes } from "node:crypto";

import { DEFAULT_SITE_GENERAL_SETTINGS } from "@bino-foundry/shared/types";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { settingsService } from "../settings/settings.service.js";
import type { SunglassesConfigDTO } from "./designs.validation.js";

function newPublicId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export class SunglassesConfigService {
  async create(dto: SunglassesConfigDTO, ownerUserId: string) {
    const supabase = getSupabaseServiceRole();
    const siteSettings = await settingsService.getGeneralSettings();
    const subtotal = dto.subtotal ?? 0;
    const publicId = newPublicId("sgl");

    const { data, error } = await supabase
      .from("sunglasses_configurations")
      .insert({
        public_id: publicId,
        status: "saved",
        owner_user_id: ownerUserId,
        frame_id: dto.frameId,
        lens_tint_id: dto.lensTintId,
        selected_options: dto.selectedOptions,
        builder_step: dto.builderStep ?? "preview",
        currency_code: dto.currencyCode ?? siteSettings.currencyCode,
        subtotal,
      })
      .select(
        "public_id, status, frame_id, lens_tint_id, selected_options, builder_step, subtotal, currency_code, created_at, updated_at",
      )
      .single();

    assertNoDbError(error);
    if (!data) throw new ValidationError("Failed to save sunglasses configuration");
    return this.mapRow(data);
  }

  async update(publicId: string, dto: SunglassesConfigDTO, ownerUserId: string) {
    const supabase = getSupabaseServiceRole();
    const existing = await this.getForOwner(publicId, ownerUserId);
    const siteSettings = await settingsService.getGeneralSettings();

    const { data, error } = await supabase
      .from("sunglasses_configurations")
      .update({
        frame_id: dto.frameId,
        lens_tint_id: dto.lensTintId,
        selected_options: dto.selectedOptions,
        builder_step: dto.builderStep ?? existing.builderStep,
        subtotal: dto.subtotal ?? existing.subtotal,
        currency_code: dto.currencyCode ?? siteSettings.currencyCode,
      })
      .eq("public_id", publicId)
      .eq("owner_user_id", ownerUserId)
      .select(
        "public_id, status, frame_id, lens_tint_id, selected_options, builder_step, subtotal, currency_code, created_at, updated_at",
      )
      .single();

    assertNoDbError(error);
    if (!data) throw new ValidationError("Failed to update sunglasses configuration");
    return this.mapRow(data);
  }

  async getByPublicId(publicId: string) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("sunglasses_configurations")
      .select(
        "public_id, status, owner_user_id, frame_id, lens_tint_id, selected_options, builder_step, subtotal, currency_code, created_at, updated_at",
      )
      .eq("public_id", publicId)
      .maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Sunglasses configuration not found");
    return this.mapRow(data);
  }

  async getForOwner(publicId: string, ownerUserId: string) {
    const config = await this.getByPublicId(publicId);
    if (config.ownerUserId && config.ownerUserId !== ownerUserId) {
      throw new NotFoundError("Sunglasses configuration not found");
    }
    return config;
  }

  async markOrdered(publicId: string, ownerUserId: string, orderReference: string) {
    const existing = await this.getForOwner(publicId, ownerUserId);
    if (existing.status !== "saved") {
      throw new ValidationError("Only saved configurations can be marked as ordered");
    }

    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("sunglasses_configurations")
      .update({
        status: "ordered",
        order_reference: orderReference,
      })
      .eq("public_id", publicId)
      .eq("owner_user_id", ownerUserId)
      .select("public_id, status, order_reference, updated_at")
      .single();

    assertNoDbError(error);
    if (!data) throw new ValidationError("Failed to update sunglasses configuration status");

    const r = data as Record<string, unknown>;
    return {
      id: String(r.public_id),
      status: String(r.status),
      orderReference: (r.order_reference as string | null) ?? null,
      updatedAt: r.updated_at,
    };
  }

  private mapRow(row: unknown) {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.public_id),
      status: String(r.status),
      ownerUserId: (r.owner_user_id as string | null) ?? null,
      frameId: String(r.frame_id),
      lensTintId: String(r.lens_tint_id),
      selectedOptions: (r.selected_options as Record<string, boolean>) ?? {},
      builderStep: String(r.builder_step ?? "frame") as SunglassesConfigDTO["builderStep"],
      subtotal: Number(r.subtotal ?? 0),
      currencyCode: String(r.currency_code ?? DEFAULT_SITE_GENERAL_SETTINGS.currencyCode),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}

export const sunglassesConfigService = new SunglassesConfigService();
