import { randomBytes } from "node:crypto";

import { applyPreparationPricing } from "@bino-foundry/shared/how-we-prepare";
import {
  DEFAULT_SITE_GENERAL_SETTINGS,
  type CustomerOrderStatus,
  type HowWePrepareOption,
  type OrderSnapshot,
  type OrderSnapshotBeadItem,
} from "@bino-foundry/shared/types";

import { getSupabaseServiceRole } from "../../infra/supabase/adminClient.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { assertNoDbError } from "../../lib/supabase-db.js";
import { braceletService } from "../bracelet/bracelet.service.js";
import { designsService } from "../designs/designs.service.js";
import { sunglassesConfigService } from "../designs/sunglasses-config.service.js";
import { howWePrepareService } from "../how-we-prepare/how-we-prepare.service.js";
import type {
  AdminOrderListQuery,
  CreateOrderDTO,
  UpdateOrderNotesDTO,
  UpdateOrderStatusDTO,
} from "./orders.validation.js";
import { enrichOrderSnapshotItemsWithRender } from "./order-snapshot-render.js";

function newOrderPublicId(): string {
  return `ord_${randomBytes(8).toString("hex")}`;
}

const ORDER_SELECT = `
  public_id, status, total_amount, currency_code, saved_design_id, customer_details,
  order_snapshot, internal_notes, status_updated_at, user_id, created_at, updated_at,
  saved_designs ( public_id, title, product_type, preview_thumbnail_url )
`;

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
    const customerNotes = dto.notes?.trim() || null;
    const customerDetails = {
      ...dto.customerDetails,
      notes: customerNotes,
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

    let snapshot: OrderSnapshot;
    try {
      snapshot = await this.buildSnapshot(design, dto, customerNotes);
    } catch (err) {
      throw err;
    }

    const { data, error } = await supabase
      .from("customer_orders")
      .insert({
        public_id: orderPublicId,
        user_id: userId,
        saved_design_id: savedDesignId,
        status: "pending",
        total_amount: snapshot.totalAmount,
        currency_code: snapshot.currencyCode,
        customer_details: customerDetails,
        order_snapshot: snapshot,
        status_updated_at: new Date().toISOString(),
      })
      .select(ORDER_SELECT)
      .single();

    assertNoDbError(error);
    if (!data) throw new ValidationError("Failed to create order");

    try {
      if (design.productType === "bracelet") {
        await braceletService.updateStatus(design.productConfigId, "ordered", orderPublicId);
      } else {
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
    } catch (err) {
      await supabase.from("customer_orders").delete().eq("public_id", orderPublicId);
      throw err;
    }

    return this.mapCustomerOrder(data, design);
  }

  async listForUser(userId: string) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("customer_orders")
      .select(ORDER_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    assertNoDbError(error);
    return (data ?? []).map((row) => this.mapCustomerOrder(row));
  }

  async getOrderForUser(userId: string, orderPublicId: string) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("customer_orders")
      .select(ORDER_SELECT)
      .eq("public_id", orderPublicId)
      .eq("user_id", userId)
      .maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Order not found");
    return this.mapCustomerOrder(data);
  }

  async listAdmin(query: AdminOrderListQuery) {
    const supabase = getSupabaseServiceRole();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const search = query.search?.trim().toLowerCase() ?? "";

    let q = supabase
      .from("customer_orders")
      .select(ORDER_SELECT, { count: "exact" })
      .order("created_at", { ascending: false });

    if (query.status) {
      q = q.eq("status", query.status);
    }

    if (!search) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);
    } else {
      q = q.limit(500);
    }

    const { data, error, count } = await q;
    assertNoDbError(error);

    let items = (data ?? []).map((row) => this.mapAdminOrder(row));

    if (search) {
      items = items.filter(
        (o) =>
          o.id.toLowerCase().includes(search) ||
          (o.customerName ?? "").toLowerCase().includes(search) ||
          (o.customerEmail ?? "").toLowerCase().includes(search) ||
          (o.designTitle ?? "").toLowerCase().includes(search),
      );
      const total = items.length;
      const start = (page - 1) * pageSize;
      items = items.slice(start, start + pageSize);
      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }

    return {
      items,
      total: count ?? items.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil((count ?? items.length) / pageSize)),
    };
  }

  async getAdminOrder(orderPublicId: string) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("customer_orders")
      .select(ORDER_SELECT)
      .eq("public_id", orderPublicId)
      .maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Order not found");
    return this.mapAdminOrderDetail(data);
  }

  async updateAdminStatus(orderPublicId: string, dto: UpdateOrderStatusDTO) {
    const supabase = getSupabaseServiceRole();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("customer_orders")
      .update({
        status: dto.status,
        status_updated_at: now,
      })
      .eq("public_id", orderPublicId)
      .select(ORDER_SELECT)
      .maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Order not found");
    return this.mapAdminOrderDetail(data);
  }

  async updateAdminNotes(orderPublicId: string, dto: UpdateOrderNotesDTO) {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("customer_orders")
      .update({
        internal_notes: dto.internalNotes,
      })
      .eq("public_id", orderPublicId)
      .select(ORDER_SELECT)
      .maybeSingle();

    assertNoDbError(error);
    if (!data) throw new NotFoundError("Order not found");
    return this.mapAdminOrderDetail(data);
  }

  private async buildSnapshot(
    design: Awaited<ReturnType<typeof designsService.getDesignForUser>>,
    dto: CreateOrderDTO,
    customerNotes: string | null,
  ): Promise<OrderSnapshot> {
    const currencyCode = design.currencyCode || DEFAULT_SITE_GENERAL_SETTINGS.currencyCode;

    if (design.productType === "bracelet") {
      const config = await braceletService.getConfiguration(design.productConfigId, {
        validateCatalog: true,
      });
      if (config.hasCatalogIssues) {
        throw new ValidationError(
          "This design contains beads that are no longer available. Replace them before ordering.",
        );
      }

      const options = (await howWePrepareService.list(true)) as HowWePrepareOption[];
      const selection = dto.preparation ?? null;
      const prepPricing = applyPreparationPricing({
        beadSubtotal: Number(config.subtotal),
        twinning: Boolean(config.twinning),
        options,
        selection,
      });

      const items: OrderSnapshotBeadItem[] = config.items.map((item) => {
        const frame = item.frame;
        return {
          strandIndex: (Number(item.strandIndex) === 1 ? 1 : 0) as 0 | 1,
          slotPosition: Number(item.slotPosition),
          beadLibraryId: String(item.beadLibraryId ?? ""),
          beadName: String(item.beadName ?? "Bead"),
          beadTypeSlug: item.beadTypeSlug ? String(item.beadTypeSlug) : undefined,
          beadSizeMm: Number(item.beadSizeMm),
          sizeLabel: String(item.sizeLabel ?? `${item.beadSizeMm} mm`),
          unitPrice: Number(item.unitPrice),
          offerKey: item.offerKey ? String(item.offerKey) : undefined,
          ...(frame
            ? {
                frame: {
                  beadLibraryId: String(frame.beadLibraryId ?? ""),
                  beadName: String(frame.beadName ?? "Frame"),
                  beadSizeMm: Number(frame.beadSizeMm),
                  sizeLabel: String(frame.sizeLabel ?? `${frame.beadSizeMm} mm`),
                  unitPrice: Number(frame.unitPrice ?? 0),
                  offerKey: frame.offerKey ? String(frame.offerKey) : undefined,
                },
              }
            : {}),
        };
      });

      const prepOption = prepPricing.preparationLineItem
        ? options.find((o) => o.slug === prepPricing.preparationLineItem!.slug)
        : null;

      const enriched = await enrichOrderSnapshotItemsWithRender(items);

      return {
        version: enriched.hasRenderFreeze ? 2 : 1,
        productType: "bracelet",
        designId: design.id,
        designTitle: design.title,
        previewThumbnailUrl: design.previewThumbnailUrl,
        currencyCode,
        beadSubtotal: Number(config.subtotal),
        preparationSubtotal: prepPricing.preparationSubtotal,
        totalAmount: prepPricing.total,
        customerNotes,
        bracelet: {
          twinning: Boolean(config.twinning),
          wristSizeCmA: Number(config.wristSizeCmA),
          wristSizeCmB: Number(config.wristSizeCmB),
          items: enriched.items,
          preparation: prepPricing.preparationLineItem
            ? {
                optionId: prepOption?.id ?? "",
                optionSlug: prepPricing.preparationLineItem.slug,
                name: prepPricing.preparationLineItem.name,
                quantity: prepPricing.preparationLineItem.quantity,
                unitPrice: prepPricing.preparationLineItem.unitPrice,
                lineTotal: prepPricing.preparationLineItem.lineTotal,
                priceType: prepPricing.preparationLineItem.priceType,
              }
            : null,
          beadSubtotal: Number(config.subtotal),
          preparationSubtotal: prepPricing.preparationSubtotal,
          strandRenderDefaults: enriched.strandRenderDefaults,
        },
      };
    }

    const config = await sunglassesConfigService.getConfiguration(design.productConfigId, {
      validateCatalog: true,
    });
    if (config.hasCatalogIssues) {
      throw new ValidationError(
        "This design contains a frame that is no longer available. Replace it before ordering.",
      );
    }

    const lensTintName = await this.resolveLensTintName(config.lensTintId);

    return {
      version: 1,
      productType: "sunglasses",
      designId: design.id,
      designTitle: design.title,
      previewThumbnailUrl: design.previewThumbnailUrl,
      currencyCode,
      beadSubtotal: Number(config.subtotal),
      preparationSubtotal: 0,
      totalAmount: Number(config.subtotal),
      customerNotes,
      sunglasses: {
        frameId: String(config.frameId),
        frameName: String(config.frameName ?? "Frame"),
        lensTintId: String(config.lensTintId),
        lensTintName,
        selectedOptions: config.selectedOptions ?? {},
        subtotal: Number(config.subtotal),
      },
    };
  }

  private async resolveLensTintName(lensTintId: string): Promise<string> {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from("sunglasses_lens_tints")
      .select("name")
      .eq("id", lensTintId)
      .maybeSingle();
    assertNoDbError(error);
    return data ? String((data as { name: string }).name ?? "Lens tint") : "Lens tint";
  }

  private mapCustomerOrder(
    row: unknown,
    designFallback?: Awaited<ReturnType<typeof designsService.getDesignForUser>>,
  ) {
    const base = this.mapOrderBase(row, designFallback);
    const r = row as Record<string, unknown>;
    return {
      ...base,
      customerDetails: (r.customer_details as Record<string, unknown> | null) ?? {},
      snapshot: this.readSnapshot(r.order_snapshot) ?? this.snapshotFromBase(base),
      updatedAt: String(r.updated_at ?? ""),
      statusUpdatedAt: String(r.status_updated_at ?? r.updated_at ?? ""),
    };
  }

  private mapAdminOrder(row: unknown) {
    const base = this.mapOrderBase(row);
    const r = row as Record<string, unknown>;
    const details = (r.customer_details as Record<string, unknown> | null) ?? {};
    return {
      id: base.id,
      status: base.status,
      totalAmount: base.totalAmount,
      currencyCode: base.currencyCode,
      designId: base.designId || null,
      designTitle: base.designTitle,
      productType: base.productType,
      customerName: details.fullName ? String(details.fullName) : null,
      customerEmail: details.email ? String(details.email) : null,
      userId: String(r.user_id ?? ""),
      createdAt: base.createdAt,
      statusUpdatedAt: String(r.status_updated_at ?? r.updated_at ?? ""),
    };
  }

  private mapAdminOrderDetail(row: unknown) {
    const summary = this.mapAdminOrder(row);
    const r = row as Record<string, unknown>;
    const snapshot = this.readSnapshot(r.order_snapshot);
    return {
      ...summary,
      customerDetails: (r.customer_details as Record<string, unknown> | null) ?? {},
      snapshot,
      previewThumbnailUrl:
        snapshot?.previewThumbnailUrl ??
        ((r.saved_designs as Record<string, unknown> | null)?.preview_thumbnail_url as string | null) ??
        null,
      internalNotes: r.internal_notes != null ? String(r.internal_notes) : null,
      updatedAt: String(r.updated_at ?? ""),
    };
  }

  private mapOrderBase(
    row: unknown,
    designFallback?: Awaited<ReturnType<typeof designsService.getDesignForUser>>,
  ) {
    const r = row as Record<string, unknown>;
    const joined = r.saved_designs as Record<string, unknown> | null | undefined;
    const snapshot = this.readSnapshot(r.order_snapshot);
    const designId =
      snapshot?.designId ??
      (joined?.public_id as string | undefined) ??
      designFallback?.id ??
      String(r.saved_design_id ?? "");
    const designTitle =
      snapshot?.designTitle ?? (joined?.title as string | null) ?? designFallback?.title ?? null;
    const productType =
      snapshot?.productType ??
      (joined?.product_type as "bracelet" | "sunglasses" | undefined) ??
      designFallback?.productType ??
      null;
    const previewThumbnailUrl =
      snapshot?.previewThumbnailUrl ??
      (joined?.preview_thumbnail_url as string | null) ??
      designFallback?.previewThumbnailUrl ??
      null;

    return {
      id: String(r.public_id),
      status: String(r.status) as CustomerOrderStatus,
      totalAmount: Number(r.total_amount ?? snapshot?.totalAmount ?? 0),
      currencyCode: String(
        r.currency_code ?? snapshot?.currencyCode ?? DEFAULT_SITE_GENERAL_SETTINGS.currencyCode,
      ),
      designId,
      designTitle,
      productType,
      previewThumbnailUrl,
      createdAt: String(r.created_at ?? ""),
    };
  }

  private readSnapshot(raw: unknown): OrderSnapshot | null {
    if (!raw || typeof raw !== "object") return null;
    const s = raw as Partial<OrderSnapshot>;
    if (s.version !== 1 || !s.productType) return null;
    return raw as OrderSnapshot;
  }

  private snapshotFromBase(
    base: ReturnType<OrdersService["mapOrderBase"]>,
  ): OrderSnapshot | null {
    if (!base.productType) return null;
    return {
      version: 1,
      productType: base.productType,
      designId: base.designId,
      designTitle: base.designTitle,
      previewThumbnailUrl: base.previewThumbnailUrl,
      currencyCode: base.currencyCode,
      beadSubtotal: base.totalAmount,
      preparationSubtotal: 0,
      totalAmount: base.totalAmount,
      customerNotes: null,
    };
  }
}

export const ordersService = new OrdersService();
