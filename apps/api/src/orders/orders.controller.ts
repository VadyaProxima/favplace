import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

@Controller("api/orders")
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.ordersService.findAll(req.user.id);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Request() req: any) {
    return this.ordersService.findOne(id, req.user.id);
  }

  @Post()
  create(@Request() req: any, @Body() body: { projectId: string }) {
    return this.ordersService.create(req.user.id, body.projectId);
  }

  @Put(":id/status")
  updateStatus(@Param("id") id: string, @Request() req: any, @Body() body: { status: string }) {
    return this.ordersService.updateStatus(id, req.user.id, body.status);
  }
}
