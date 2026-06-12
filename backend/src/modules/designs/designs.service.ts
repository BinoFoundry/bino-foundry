import { randomBytes } from "node:crypto";

import { DEFAULT_SITE_GENERAL_SETTINGS } from "@bino-foundry/shared/types";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { NotFoundError } from "../../lib/errors.js";
import { braceletService } from "../bracelet/bracelet.service.js";
import type { CreateBraceletConfigDTO } from "../bracelet/bracelet.validation.js";
import { sunglassesConfigService } from "./sunglasses-config.service.js";
import type { SaveDesignDTO } from "./designs.validation.js";
import { persistDesignThumbnail } from "./design-thumbnail.service.js";

const DESIGN_SUMMARY_SELECT =
  "public_id, product_type, status, title, subtotal, currency_code, product_config_id, order_reference, preview_thumbnail_url, created_at, updated_at";

function newDesignPublicId(): string {
  return `dsn_${randomBytes(8).toString("hex")}`;
}

function defaultTitle(productType: SaveDesignDTO["productType"]): string {
  return productType === "bracelet" ? "My bracelet" : "My sunglasses";
}

export class DesignsService {
  async saveDesign(userId: string, dto: SaveDesignDTO) {
    if (dto.designId) {
      return this.updateDesign(userId, dto.designId, dto);
    }
    return this.createDesign(userId, dto);
  }

  async createDesign(userId: string, dto: SaveDesignDTO) {
    const status = dto.status ?? "saved";
    let productConfigId: string;
    let subtotal: number;
    let currencyCode: string;

    if (dto.productType === "bracelet" && dto.bracelet) {
      const braceletDto: CreateBraceletConfigDTO = {
        ...dto.bracelet,
        status,
      };
      const saved = await braceletService.createConfiguration(braceletDto, userId);
      productConfigId = String(saved.id);
      subtotal = Number(saved.subtotal);
      currencyCode = String(saved.currencyCode);
    } else if (dto.productType === "sunglasses" && dto.sunglasses) {
      const saved = await sunglassesConfigService.create(dto.sunglasses, userId);
      productConfigId = String(saved.id);
      subtotal = Number(saved.subtotal);
      currencyCode = String(saved.currencyCode);
    } else {
      throw new NotFoundError("Invalid design payload");
    }

    const supabase = getSupabaseServiceRole();
    const publicId = newDesignPublicId();
    const previewThumbnailUrl = dto.previewThumbnailDataUrl
      ? await persistDesignThumbnail(userId, publicId, dto.previewThumbnailDataUrl)
      : null;

    const { data, error } = await supabase
      .from("saved_designs")
      .insert({
        public_id: publicId,
        user_id: userId,
        product_type: dto.productType,
        title: dto.title ?? defaultTitle(dto.productType),
        status,
        product_config_id: productConfigId,
        subtotal,
        currency_code: currencyCode,
        preview_thumbnail_url: previewThumbnailUrl,
      })
      .select(DESIGN_SUMMARY_SELECT)
      .single();

    assertNoDbError(error);
    return this.mapSummary(data);
  }

  async updateDesign(userId: string, designPublicId: string, dto: SaveDesignDTO) {
    const existing = await this.getDesignForUser(userId, designPublicId);
    const status = dto.status ?? existing.status;

    let subtotal = existing.subtotal;
    let currencyCode = existing.currencyCode;

    if (dto.productType === "bracelet" && dto.bracelet) {
      await braceletService.updateConfiguration(existing.productConfigId, {
        ...dto.bracelet,
        status: status === "draft" ? "draft" : "saved",
      });
      const refreshed = await braceletService.getConfiguration(existing.productConfigId);
      subtotal = Number(refreshed.subtotal);
      currencyCode = String(refreshed.currencyCode);
    } else if (dto.productType === "sunglasses" && dto.sunglasses) {
      const saved = await sunglassesConfigService.update(existing.productConfigId, dto.sunglasses, userId);
      subtotal = saved.subtotal;
      currencyCode = saved.currencyCode;
    }

    const supabase = getSupabaseServiceRole();
    let previewThumbnailUrl: string | null | undefined;
    if (dto.previewThumbnailDataUrl) {
      previewThumbnailUrl = await persistDesignThumbnail(userId, designPublicId, dto.previewThumbnailDataUrl);
    }

    const { data, error } = await supabase
      .from("saved_designs")
      .update({
        title: dto.title ?? existing.title,
        status,
        subtotal,
        currency_code: currencyCode,
        ...(previewThumbnailUrl !== undefined ? { preview_thumbnail_url: previewThumbnailUrl } : {}),
      })
      .eq("public_id", designPublicId)
      .eq("user_id", userId)
      .select(DESIGN_SUMMARY_SELECT)
      .single();

    assertNoDbError(error);
    return this.mapSummary(data);
  }

  async listForUser(userId: string) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("saved_designs")
      .select(DESIGN_SUMMARY_SELECT)
      .eq("user_id", userId)
      .neq("status", "archived")
      .order("updated_at", { ascending: false })
      .limit(100);

    assertNoDbError(error);
    return (data ?? []).map((row) => this.mapSummary(row));
  }

  async getDesignForUser(userId: string, designPublicId: string) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("saved_designs")
      .select(DESIGN_SUMMARY_SELECT)
      .eq("public_id", designPublicId)
      .eq("user_id", userId)
      .maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Saved design not found");
    return this.mapSummary(data);
  }

  async getDesignDetail(userId: string, designPublicId: string) {
    const summary = await this.getDesignForUser(userId, designPublicId);

    if (summary.productType === "bracelet") {
      const bracelet = await braceletService.getConfiguration(summary.productConfigId, {
        validateCatalog: true,
      });
      return { ...summary, bracelet };
    }

    const sunglasses = await sunglassesConfigService.getForOwner(summary.productConfigId, userId);
    return { ...summary, sunglasses };
  }

  async duplicateDesign(userId: string, designPublicId: string) {
    const detail = await this.getDesignDetail(userId, designPublicId);
    const copyTitle = `${detail.title ?? "Untitled design"} (copy)`;

    if (detail.productType === "bracelet" && "bracelet" in detail && detail.bracelet) {
      const bracelet = detail.bracelet;
      return this.createDesign(userId, {
        productType: "bracelet",
        title: copyTitle,
        status: "saved",
        bracelet: {
          twinning: Boolean(bracelet.twinning),
          wristSizeCmA: Number(bracelet.wristSizeCmA),
          wristSizeCmB: Number(bracelet.wristSizeCmB),
          defaultBeadSizeMm:
            bracelet.defaultBeadSizeMm == null ? null : Number(bracelet.defaultBeadSizeMm),
          status: "saved",
          items: bracelet.items.map((item) => ({
            strandIndex: item.strandIndex as 0 | 1,
            slotPosition: Number(item.slotPosition),
            beadLibraryId: String(item.beadLibraryId),
            beadSizeMm: Number(item.beadSizeMm),
          })),
        },
      });
    }

    if (detail.productType === "sunglasses" && "sunglasses" in detail && detail.sunglasses) {
      const sunglasses = detail.sunglasses;
      return this.createDesign(userId, {
        productType: "sunglasses",
        title: copyTitle,
        status: "saved",
        sunglasses: {
          frameId: sunglasses.frameId,
          lensTintId: sunglasses.lensTintId,
          selectedOptions: sunglasses.selectedOptions,
          builderStep: sunglasses.builderStep,
          subtotal: sunglasses.subtotal,
          currencyCode: sunglasses.currencyCode,
        },
      });
    }

    throw new NotFoundError("Cannot duplicate this design");
  }

  async deleteDesign(userId: string, designPublicId: string) {
    const existing = await this.getDesignForUser(userId, designPublicId);
    const supabase = getSupabaseServiceRole();
    const { error } = await supabase
      .from("saved_designs")
      .update({ status: "archived" })
      .eq("public_id", designPublicId)
      .eq("user_id", userId);

    assertNoDbError(error);
    return { id: existing.id, archived: true };
  }

  private mapSummary(row: unknown) {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.public_id),
      productType: r.product_type as "bracelet" | "sunglasses",
      status: String(r.status),
      title: (r.title as string | null) ?? null,
      subtotal: Number(r.subtotal ?? 0),
      currencyCode: String(r.currency_code ?? DEFAULT_SITE_GENERAL_SETTINGS.currencyCode),
      productConfigId: String(r.product_config_id),
      orderReference: (r.order_reference as string | null) ?? null,
      previewThumbnailUrl: (r.preview_thumbnail_url as string | null) ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}

export const designsService = new DesignsService();
