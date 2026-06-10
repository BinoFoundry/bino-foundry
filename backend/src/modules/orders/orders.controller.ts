import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendData, sendDataCreated } from "../../lib/http-response.js";
import { getAuthUserId } from "../../middleware/auth-mutations.js";
import { createOrderDto, orderIdParam } from "./orders.validation.js";
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

export const ordersHandlers = {
  listOrders: asyncHandler(listOrders),
  getOrder: asyncHandler(getOrder),
  createOrder: asyncHandler(createOrder),
};
