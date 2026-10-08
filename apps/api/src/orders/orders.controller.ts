import { Body, Controller, Post } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import type { CheckoutRequest } from "@favplace/shared";

@Controller("api/orders")
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  /**
   * Публичная заявка из конструктора — без регистрации.
   * Оплата не списывается: менеджер связывается с клиентом и подтверждает заказ.
   */
  @Post("checkout")
  checkout(@Body() body: CheckoutRequest) {
    return this.ordersService.checkout(body);
  }
}
