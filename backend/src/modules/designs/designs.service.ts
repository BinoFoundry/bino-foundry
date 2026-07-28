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
import { uploadService } from "../upload/upload.service.js";

const DESIGN_SUMMARY_SELECT =
  "public_id, product_type, status, title, subtotal, currency_code, product_config_id, order_reference, preview_thumbnail_url, created_at, updated_at";

function newDesignPublicId(): string {
  return `dsn_${randomBytes(8).toString("hex")}`;
}

function normalizeDesignTitle(title: string | undefined): string | null {
  if (title === undefined) return null;
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : null;
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
        title: normalizeDesignTitle(dto.title),
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
        title: dto.title !== undefined ? normalizeDesignTitle(dto.title) : existing.title,
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
        validateCatalog: false,
      });
      return { ...summary, bracelet };
    }

    const sunglasses = await sunglassesConfigService.getForOwner(summary.productConfigId, userId);
    return { ...summary, sunglasses };
  }

  async duplicateDesign(userId: string, designPublicId: string) {
    const detail = await this.getDesignDetail(userId, designPublicId);
    const baseTitle =
      detail.title?.trim() ||
      (detail.productType === "bracelet" ? "Bracelet" : "Sunglasses");
    const copyTitle = `${baseTitle} (copy)`;

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
    // Ownership check first so unowned ids stay 404 (no existence leak beyond "not found").
    await this.getDesignForUser(userId, designPublicId);
    const result = await this.bulkDeleteDesigns(userId, [designPublicId]);
    if (result.failed > 0 && result.deleted === 0) {
      throw new NotFoundError("Saved design not found");
    }
    return { id: designPublicId, deleted: result.deleted > 0 };
  }

  /**
   * Soft-archive designs that were ordered / referenced by an order.
   * Permanently delete unused designs and exclusive product configs / thumbnails.
   * Ownership is enforced for every id — unowned ids are skipped, not deleted.
   */
  async bulkDeleteDesigns(userId: string, designPublicIds: string[]) {
    const uniqueIds = [...new Set(designPublicIds.map((id) => id.trim()).filter(Boolean))];
    const result = {
      deleted: 0,
      failed: 0,
      skipped: 0,
      deletedIds: [] as string[],
      failedIds: [] as string[],
      skippedIds: [] as string[],
    };

    if (uniqueIds.length === 0) return result;

    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("saved_designs")
      .select(
        "id, public_id, user_id, product_type, status, product_config_id, order_reference, preview_thumbnail_url",
      )
      .eq("user_id", userId)
      .in("public_id", uniqueIds);

    assertNoDbError(error);

    const byPublicId = new Map(
      (data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return [String(r.public_id), r] as const;
      }),
    );

    for (const publicId of uniqueIds) {
      const row = byPublicId.get(publicId);
      if (!row) {
        result.skipped += 1;
        result.skippedIds.push(publicId);
        continue;
      }

      if (String(row.status) === "archived") {
        result.skipped += 1;
        result.skippedIds.push(publicId);
        continue;
      }

      try {
        const used = await this.isDesignInUse(String(row.id), row);
        if (used) {
          await this.softDeleteDesignRow(userId, publicId);
        } else {
          await this.hardDeleteDesignRow(userId, row);
        }
        result.deleted += 1;
        result.deletedIds.push(publicId);
      } catch {
        result.failed += 1;
        result.failedIds.push(publicId);
      }
    }

    return result;
  }

  private async isDesignInUse(internalId: string, row: Record<string, unknown>): Promise<boolean> {
    if (String(row.status) === "ordered") return true;
    if (row.order_reference) return true;

    const supabase = getSupabaseServiceRole();
    const { count, error } = await supabase
      .from("customer_orders")
      .select("id", { count: "exact", head: true })
      .eq("saved_design_id", internalId);

    assertNoDbError(error);
    return (count ?? 0) > 0;
  }

  private async softDeleteDesignRow(userId: string, designPublicId: string) {
    const supabase = getSupabaseServiceRole();
    const { error } = await supabase
      .from("saved_designs")
      .update({ status: "archived" })
      .eq("public_id", designPublicId)
      .eq("user_id", userId);
    assertNoDbError(error);
  }

  private async hardDeleteDesignRow(userId: string, row: Record<string, unknown>) {
    const supabase = getSupabaseServiceRole();
    const publicId = String(row.public_id);
    const productType = String(row.product_type);
    const productConfigId = String(row.product_config_id);
    const thumbnailUrl =
      typeof row.preview_thumbnail_url === "string" ? row.preview_thumbnail_url : null;

    // Drop the index row first so orders SET NULL and the unique config link is freed.
    const { error: deleteError } = await supabase
      .from("saved_designs")
      .delete()
      .eq("public_id", publicId)
      .eq("user_id", userId);
    assertNoDbError(deleteError);

    // Best-effort cleanup of exclusive builder configs / thumbnails.
    try {
      if (productType === "bracelet" && productConfigId) {
        const { error } = await supabase
          .from("bracelet_configurations")
          .delete()
          .eq("public_id", productConfigId);
        assertNoDbError(error);
      } else if (productType === "sunglasses" && productConfigId) {
        const { error } = await supabase
          .from("sunglasses_configurations")
          .delete()
          .eq("public_id", productConfigId)
          .eq("owner_user_id", userId);
        assertNoDbError(error);
      }
    } catch {
      // Design is already removed from the account index.
    }

    if (thumbnailUrl) {
      await this.removeExclusiveThumbnail(thumbnailUrl);
    }
  }

  /** Deletes a preview thumbnail only when no other saved design still references it. */
  private async removeExclusiveThumbnail(thumbnailUrl: string) {
    const supabase = getSupabaseServiceRole();
    const { count, error } = await supabase
      .from("saved_designs")
      .select("id", { count: "exact", head: true })
      .eq("preview_thumbnail_url", thumbnailUrl);

    assertNoDbError(error);
    if ((count ?? 0) > 0) return;

    try {
      await uploadService.deleteUploadedPublicUrl(thumbnailUrl);
    } catch {
      // Best-effort storage cleanup — design row is already gone.
    }
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
