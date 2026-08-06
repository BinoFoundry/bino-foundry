import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendData, sendDataCreated } from "../../lib/http-response.js";
import { getAuthUserId } from "../../middleware/auth-mutations.js";
import {
  adminOrderListQuery,
  createOrderDto,
  orderIdParam,
  updateOrderNotesDto,
  updateOrderStatusDto,
} from "./orders.validation.js";
import { ordersService } from "./orders.service.js";

async function listOrders(req: Request, res: Response): Promise<void> {
  const userId = getAuthUserId(req)!;
  sendData(req, res, await ordersService.listForUser(userId));
}

async function getOrder(req: Request, res: Response): Promise<void> {
  const userId = getAuthUserId(req)!;
  const { id } = orderIdParam.parse(req.params);
  sendData(req, res, await ordersService.getOrderForUser(userId, id));
}

async function createOrder(req: Request, res: Response): Promise<void> {
  const userId = getAuthUserId(req)!;
  const body = createOrderDto.parse(req.body);
  sendDataCreated(req, res, await ordersService.createOrder(userId, body));
}

async function listAdminOrders(req: Request, res: Response): Promise<void> {
  const query = adminOrderListQuery.parse(req.query);
  sendData(req, res, await ordersService.listAdmin(query));
}

async function getAdminOrder(req: Request, res: Response): Promise<void> {
  const { id } = orderIdParam.parse(req.params);
  sendData(req, res, await ordersService.getAdminOrder(id));
}

async function updateAdminOrderStatus(req: Request, res: Response): Promise<void> {
  const { id } = orderIdParam.parse(req.params);
  const body = updateOrderStatusDto.parse(req.body);
  sendData(req, res, await ordersService.updateAdminStatus(id, body));
}

async function updateAdminOrderNotes(req: Request, res: Response): Promise<void> {
  const { id } = orderIdParam.parse(req.params);
  const body = updateOrderNotesDto.parse(req.body);
  sendData(req, res, await ordersService.updateAdminNotes(id, body));
}

export const ordersHandlers = {
  listOrders: asyncHandler(listOrders),
  getOrder: asyncHandler(getOrder),
  createOrder: asyncHandler(createOrder),
  listAdminOrders: asyncHandler(listAdminOrders),
  getAdminOrder: asyncHandler(getAdminOrder),
  updateAdminOrderStatus: asyncHandler(updateAdminOrderStatus),
  updateAdminOrderNotes: asyncHandler(updateAdminOrderNotes),
};
