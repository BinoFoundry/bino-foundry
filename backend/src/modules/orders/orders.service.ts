import { randomBytes } from "node:crypto";

import { DEFAULT_SITE_GENERAL_SETTINGS } from "@bino-foundry/shared/types";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { braceletService } from "../bracelet/bracelet.service.js";
import { designsService } from "../designs/designs.service.js";
import { sunglassesConfigService } from "../designs/sunglasses-config.service.js";
import type { CreateOrderDTO } from "./orders.validation.js";

function newOrderPublicId(): string {
  return `ord_${randomBytes(8).toString("hex")}`;
}

export class OrdersService {
  async createOrder(userId: string, dto: CreateOrderDTO) {
    const design = await designsService.getDesignForUser(userId, dto.designId);
    if (design.status === "ordered") {
      throw new ConflictError("This design has already been ordered");
    }
    if (design.status === "archived") {
      throw new ValidationError("Cannot order an archived design");
    }

    const supabase = getSupabaseServiceRole();
    const orderPublicId = newOrderPublicId();
    const customerDetails = {
      ...dto.customerDetails,
      notes: dto.notes ?? null,
    };

    const { data: savedDesignRow, error: designLookupError } = await supabase
      .from("saved_designs")
      .select("id")
      .eq("public_id", dto.designId)
      .eq("user_id", userId)
      .maybeSingle();

    assertNoDbError(designLookupError);
    if (!savedDesignRow) throw new NotFoundError("Saved design not found");

    const savedDesignId = String((savedDesignRow as { id: string }).id);

    const { data, error } = await supabase
      .from("customer_orders")
      .insert({
        public_id: orderPublicId,
        user_id: userId,
        saved_design_id: savedDesignId,
        status: "pending",
        total_amount: design.subtotal,
        currency_code: design.currencyCode,
        customer_details: customerDetails,
      })
      .select(
        "public_id, status, total_amount, currency_code, saved_design_id, customer_details, created_at, updated_at",
      )
      .single();

    assertNoDbError(error);
    if (!data) throw new ValidationError("Failed to create order");

    if (design.productType === "bracelet") {
      const config = await braceletService.getConfiguration(design.productConfigId, {
        validateCatalog: true,
      });
      if (config.hasCatalogIssues) {
        throw new ValidationError(
          "This design contains beads that are no longer available. Replace them before ordering.",
        );
      }
      await braceletService.updateStatus(design.productConfigId, "ordered", orderPublicId);
    } else {
      const config = await sunglassesConfigService.getConfiguration(design.productConfigId, {
        validateCatalog: true,
      });
      if (config.hasCatalogIssues) {
        throw new ValidationError(
          "This design contains a frame that is no longer available. Replace it before ordering.",
        );
      }
      await sunglassesConfigService.markOrdered(design.productConfigId, userId, orderPublicId);
    }

    const { error: designUpdateError } = await supabase
      .from("saved_designs")
      .update({
        status: "ordered",
        order_reference: orderPublicId,
      })
      .eq("public_id", dto.designId)
      .eq("user_id", userId);

    assertNoDbError(designUpdateError);

    return this.mapOrder(data, design);
  }

  async listForUser(userId: string) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("customer_orders")
      .select(
        "public_id, status, total_amount, currency_code, saved_design_id, customer_details, created_at, updated_at, saved_designs ( public_id, title, product_type, preview_thumbnail_url )",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    assertNoDbError(error);
    return (data ?? []).map((row) => this.mapOrder(row));
  }

  async getOrderForUser(userId: string, orderPublicId: string) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("customer_orders")
      .select(
        "public_id, status, total_amount, currency_code, saved_design_id, customer_details, created_at, updated_at, saved_designs ( public_id, title, product_type, preview_thumbnail_url )",
      )
      .eq("public_id", orderPublicId)
      .eq("user_id", userId)
      .maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Order not found");
    return this.mapOrder(data);
  }

  private mapOrder(row: unknown, designFallback?: Awaited<ReturnType<typeof designsService.getDesignForUser>>) {
    const r = row as Record<string, unknown>;
    const joined = r.saved_designs as Record<string, unknown> | null | undefined;
    const designId =
      (joined?.public_id as string | undefined) ??
      designFallback?.id ??
      String(r.saved_design_id ?? "");
    const designTitle = (joined?.title as string | null) ?? designFallback?.title ?? null;
    const productType =
      (joined?.product_type as "bracelet" | "sunglasses" | undefined) ?? designFallback?.productType;
    const previewThumbnailUrl =
      (joined?.preview_thumbnail_url as string | null) ?? null;

    return {
      id: String(r.public_id),
      status: String(r.status),
      totalAmount: Number(r.total_amount ?? 0),
      currencyCode: String(r.currency_code ?? DEFAULT_SITE_GENERAL_SETTINGS.currencyCode),
      designId,
      designTitle,
      productType: productType ?? null,
      previewThumbnailUrl,
      customerDetails: (r.customer_details as Record<string, unknown> | null) ?? {},
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}

export const ordersService = new OrdersService();
