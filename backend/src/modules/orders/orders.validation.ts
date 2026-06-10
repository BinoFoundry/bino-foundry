import { z } from "zod";

export const customerDetailsDto = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).optional(),
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().min(1).max(32),
  country: z.string().trim().length(2).default("US"),
});

export const createOrderDto = z.object({
  designId: z.string().min(1),
  customerDetails: customerDetailsDto,
  notes: z.string().trim().max(500).optional(),
});

export const orderIdParam = z.object({
  id: z.string().min(1),
});

export type CreateOrderDTO = z.infer<typeof createOrderDto>;
export type CustomerDetailsDTO = z.infer<typeof customerDetailsDto>;
