import { CUSTOMER_NAME_MAX_LENGTH, CUSTOMER_NAME_REQUIRED_MESSAGE } from "@bino-foundry/shared/constants";
import { z } from "zod";

const orderStatusSchema = z.enum([
  "pending",
  "confirmed",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);

export const customerDetailsDto = z.object({
  fullName: z
    .string({ required_error: CUSTOMER_NAME_REQUIRED_MESSAGE })
    .trim()
    .min(1, CUSTOMER_NAME_REQUIRED_MESSAGE)
    .max(CUSTOMER_NAME_MAX_LENGTH),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).optional(),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().min(1).max(32),
  country: z.string().trim().length(2).default("US"),
});

export const preparationSelectionDto = z.object({
  optionSlug: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1).max(99),
});

export const createOrderDto = z.object({
  designId: z.string().min(1),
  customerDetails: customerDetailsDto,
  notes: z.string().trim().max(500).optional(),
  preparation: preparationSelectionDto.optional(),
});

export const orderIdParam = z.object({
  id: z.string().min(1),
});

export const updateOrderStatusDto = z.object({
  status: orderStatusSchema,
});

export const updateOrderNotesDto = z.object({
  internalNotes: z.string().trim().max(4000).nullable(),
});

export const adminOrderListQuery = z.object({
  status: orderStatusSchema.optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateOrderDTO = z.infer<typeof createOrderDto>;
export type CustomerDetailsDTO = z.infer<typeof customerDetailsDto>;
export type UpdateOrderStatusDTO = z.infer<typeof updateOrderStatusDto>;
export type UpdateOrderNotesDTO = z.infer<typeof updateOrderNotesDto>;
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuery>;
