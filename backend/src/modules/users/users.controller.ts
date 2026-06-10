import type { Request, Response } from "express";

import { asyncHandler } from "../../lib/async-handler.js";
import { sendCreated, sendJson } from "../../lib/http-response.js";
import { validateBody, validateQuery } from "../../lib/validation.js";
import { usersService } from "./users.service.js";
import {
  createUserDto,
  listUsersQuery,
  resetPasswordDto,
  updateUserDto,
  userIdParam,
  type CreateUserDTO,
  type ListUsersQueryDTO,
} from "./users.validation.js";

async function list(req: Request, res: Response) {
  const query = validateQuery(listUsersQuery, req.query) as ListUsersQueryDTO;
  sendJson(res, await usersService.list(query));
}

async function retrieve(req: Request, res: Response) {
  const { id } = userIdParam.parse(req.params);
  sendJson(res, await usersService.getById(id));
}

async function create(req: Request, res: Response) {
  const payload = validateBody(createUserDto, req.body) as CreateUserDTO;
  sendCreated(res, await usersService.create(payload));
}

async function update(req: Request, res: Response) {
  const { id } = userIdParam.parse(req.params);
  const payload = validateBody(updateUserDto, req.body);
  sendJson(res, await usersService.update(id, payload));
}

async function remove(req: Request, res: Response) {
  const { id } = userIdParam.parse(req.params);
  sendJson(res, await usersService.softDelete(id));
}

async function resetPassword(req: Request, res: Response) {
  const { id } = userIdParam.parse(req.params);
  const payload = validateBody(resetPasswordDto, req.body);
  sendJson(res, await usersService.resetPassword(id, payload));
}

async function listDesigns(req: Request, res: Response) {
  const { id } = userIdParam.parse(req.params);
  sendJson(res, await usersService.listDesignsForUser(id));
}

async function listOrders(req: Request, res: Response) {
  const { id } = userIdParam.parse(req.params);
  sendJson(res, await usersService.listOrdersForUser(id));
}

export const usersHandlers = {
  list: asyncHandler(list),
  retrieve: asyncHandler(retrieve),
  create: asyncHandler(create),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
  resetPassword: asyncHandler(resetPassword),
  listDesigns: asyncHandler(listDesigns),
  listOrders: asyncHandler(listOrders),
};
