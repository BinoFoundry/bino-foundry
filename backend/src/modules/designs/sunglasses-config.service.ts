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

type CatalogIssue = "deleted" | "unavailable" | null;

function resolveFrameCatalogIssue(
  frame: Record<string, unknown> | null,
  status: { allow_new_designs?: boolean } | null,
): CatalogIssue {
  if (!frame) return "deleted";
  if (status?.allow_new_designs !== true) return "unavailable";
  return null;
}

export class SunglassesConfigService {
  private async assertFrameAvailableForSave(frameId: string): Promise<void> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("frames")
      .select("id, name, catalog_availability_statuses(allow_new_designs, label)")
      .eq("id", frameId)
      .maybeSingle();

    assertNoDbError(error);
    if (!data) {
      throw new ValidationError("Selected frame is no longer available. Choose another frame.");
    }

    const status = (data as Record<string, unknown>).catalog_availability_statuses as {
      allow_new_designs?: boolean;
      label?: string;
    } | null;

    if (status?.allow_new_designs !== true) {
      const frameName = String((data as { name?: string }).name ?? "This frame");
      throw new ValidationError(
        `"${frameName}" is not available for new designs. Choose another frame.`,
      );
    }
  }

  async create(dto: SunglassesConfigDTO, ownerUserId: string) {
    await this.assertFrameAvailableForSave(dto.frameId);

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
        frame_id_snapshot: dto.frameId,
        lens_tint_id: dto.lensTintId,
        selected_options: dto.selectedOptions,
        builder_step: dto.builderStep ?? "preview",
        currency_code: dto.currencyCode ?? siteSettings.currencyCode,
        subtotal,
      })
      .select(
        "public_id, status, frame_id, frame_id_snapshot, lens_tint_id, selected_options, builder_step, subtotal, currency_code, created_at, updated_at",
      )
      .single();

    assertNoDbError(error);
    if (!data) throw new ValidationError("Failed to save sunglasses configuration");
    return this.getConfiguration(String((data as { public_id: string }).public_id), {
      validateCatalog: false,
    });
  }

  async update(publicId: string, dto: SunglassesConfigDTO, ownerUserId: string) {
    await this.getForOwner(publicId, ownerUserId);
    await this.assertFrameAvailableForSave(dto.frameId);

    const supabase = getSupabaseServiceRole();
    const existing = await this.getByPublicId(publicId);
    const siteSettings = await settingsService.getGeneralSettings();

    const { data, error } = await supabase
      .from("sunglasses_configurations")
      .update({
        frame_id: dto.frameId,
        frame_id_snapshot: dto.frameId,
        lens_tint_id: dto.lensTintId,
        selected_options: dto.selectedOptions,
        builder_step: dto.builderStep ?? existing.builderStep,
        subtotal: dto.subtotal ?? existing.subtotal,
        currency_code: dto.currencyCode ?? siteSettings.currencyCode,
      })
      .eq("public_id", publicId)
      .eq("owner_user_id", ownerUserId)
      .select(
        "public_id, status, frame_id, frame_id_snapshot, lens_tint_id, selected_options, builder_step, subtotal, currency_code, created_at, updated_at",
      )
      .single();

    assertNoDbError(error);
    if (!data) throw new ValidationError("Failed to update sunglasses configuration");
    return this.getConfiguration(publicId, { validateCatalog: false });
  }

  async getByPublicId(publicId: string) {
    const config = await this.getConfiguration(publicId, { validateCatalog: false });
    return config;
  }

  async getForOwner(publicId: string, ownerUserId: string) {
    const config = await this.getConfiguration(publicId, { validateCatalog: false });
    if (config.ownerUserId && config.ownerUserId !== ownerUserId) {
      throw new NotFoundError("Sunglasses configuration not found");
    }
    return config;
  }

  async getConfiguration(publicId: string, options?: { validateCatalog?: boolean }) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("sunglasses_configurations")
      .select(
        "public_id, status, owner_user_id, frame_id, frame_id_snapshot, lens_tint_id, selected_options, builder_step, subtotal, currency_code, created_at, updated_at, frames(id, name, availability_status_code, catalog_availability_statuses(show_in_builder, allow_new_designs, label))",
      )
      .eq("public_id", publicId)
      .maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Sunglasses configuration not found");

    const r = data as Record<string, unknown>;
    const frame = r.frames as Record<string, unknown> | null;
    const status = frame?.catalog_availability_statuses as {
      show_in_builder?: boolean;
      allow_new_designs?: boolean;
      label?: string;
    } | null;
    const snapshotId = String(r.frame_id_snapshot ?? "").trim();
    const frameUuid = r.frame_id ? String(r.frame_id) : "";
    const catalogIssue = resolveFrameCatalogIssue(frame, status);
    const frameId = frameUuid || snapshotId;

    if (options?.validateCatalog && catalogIssue) {
      throw new ValidationError(
        catalogIssue === "deleted"
          ? "This design references a frame that is no longer available. Replace it before ordering."
          : "This design references a frame that is not available for ordering. Replace it before ordering.",
      );
    }

    const missingFrameIds = catalogIssue === "deleted" && frameId ? [frameId] : [];
    const unavailableFrameIds = catalogIssue === "unavailable" && frameId ? [frameId] : [];

    return {
      id: String(r.public_id),
      status: String(r.status),
      ownerUserId: (r.owner_user_id as string | null) ?? null,
      frameId,
      frameName: frame ? String(frame.name ?? "") : undefined,
      lensTintId: String(r.lens_tint_id),
      selectedOptions: (r.selected_options as Record<string, boolean>) ?? {},
      builderStep: String(r.builder_step ?? "frame") as SunglassesConfigDTO["builderStep"],
      subtotal: Number(r.subtotal ?? 0),
      currencyCode: String(r.currency_code ?? DEFAULT_SITE_GENERAL_SETTINGS.currencyCode),
      catalogIssue,
      availabilityStatusCode: frame ? String(frame.availability_status_code ?? "ACTIVE") : null,
      availabilityStatusLabel: status?.label ?? null,
      catalogWarnings:
        missingFrameIds.length || unavailableFrameIds.length
          ? {
              missingFrameIds,
              unavailableFrameIds,
            }
          : undefined,
      hasCatalogIssues: catalogIssue != null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
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

    const row = data as Record<string, unknown>;
    return {
      id: String(row.public_id),
      status: String(row.status),
      orderReference: (row.order_reference as string | null) ?? null,
      updatedAt: row.updated_at,
    };
  }
}

export const sunglassesConfigService = new SunglassesConfigService();
