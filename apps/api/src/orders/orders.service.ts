import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  MATERIALS,
  RING_FORMS,
  RING_SIZES_MM,
  calcPrice,
  formatPrice,
  type CheckoutRequest,
  type CheckoutResponse,
} from "@favplace/shared";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private prisma: PrismaService) {}

  /** Заявка из конструктора: без авторизации, цена пересчитывается на сервере. */
  async checkout(body: CheckoutRequest): Promise<CheckoutResponse> {
    const config = body?.config;
    const customer = body?.customer;
    if (!config || !customer) throw new BadRequestException("Пустая заявка");

    if (!RING_FORMS.includes(config.ringForm)) {
      throw new BadRequestException("Неизвестная форма изделия");
    }
    if (!(config.material in MATERIALS)) {
      throw new BadRequestException("Неизвестный металл");
    }
    if (!RING_SIZES_MM.includes(config.ringSize)) {
      throw new BadRequestException("Недоступный размер кольца");
    }
    if (!config.location) {
      throw new BadRequestException("Не выбрано место для рельефа");
    }

    const name = (customer.name ?? "").trim();
    const phone = (customer.phone ?? "").trim();
    const email = (customer.email ?? "").trim();
    const delivery = (customer.delivery ?? "").trim();

    if (name.length < 2) throw new BadRequestException("Укажите имя");
    if (phone.replace(/\D/g, "").length < 10) throw new BadRequestException("Укажите телефон");
    if (!EMAIL_RE.test(email)) throw new BadRequestException("Проверьте email");
    if (delivery.length < 4) throw new BadRequestException("Укажите пункт выдачи");

    // Цену берём только из собственного расчёта — присланной с клиента не верим.
    const { total } = calcPrice({
      ringForm: config.ringForm,
      material: config.material,
      reliefDetail: config.reliefDetail,
      engraving: config.engraving,
      twoTone: config.twoTone,
    });

    const order = await this.prisma.order.create({
      data: {
        number: await this.nextNumber(),
        status: "pending",
        totalPrice: total,
        configJson: JSON.stringify(config),
        shareUrl: config.shareUrl ?? null,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        delivery,
        comment: (customer.comment ?? "").trim() || null,
        promo: (customer.promo ?? "").trim() || null,
      },
    });

    void this.notify(order.number, total, config, { name, phone, email, delivery });

    return {
      id: order.id,
      number: order.number,
      totalPrice: total,
      status: "pending",
    };
  }

  /**
   * FP-000123 — последовательный человекочитаемый номер.
   *
   * Номер выдаёт постгресовая секвенция: nextval атомарен, поэтому два
   * параллельных чекаута не могут получить одно значение. Считать count()
   * и подбирать свободный номер нельзя — это гонка.
   */
  private async nextNumber(): Promise<string> {
    const rows = await this.prisma.$queryRaw<{ nextval: bigint }[]>`
      SELECT nextval('order_number_seq')
    `;
    return `FP-${String(rows[0].nextval).padStart(6, "0")}`;
  }

  /**
   * Уведомление менеджеру в Telegram. Работает только если заданы
   * TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID — иначе заявка просто пишется в лог.
   */
  private async notify(
    number: string,
    total: number,
    config: CheckoutRequest["config"],
    customer: { name: string; phone: string; email: string; delivery: string },
  ): Promise<void> {
    const lines = [
      `Заявка ${number} — ${formatPrice(total)}`,
      "",
      `Форма: ${config.ringForm}`,
      `Металл: ${MATERIALS[config.material].label}, ${config.surfaceFinish === "polished" ? "полированная" : "матовая"}`,
      `Размер: ⌀ ${config.ringSize} мм`,
      `Рельеф: ${config.reliefHeight} мм, детализация ${config.reliefDetail}`,
      config.engraving ? `Гравировка: «${config.engraving}»` : null,
      config.location
        ? `Место: ${config.location.name} (${config.location.lat.toFixed(5)}, ${config.location.lng.toFixed(5)}), радиус ${config.radius} м`
        : null,
      "",
      `${customer.name} · ${customer.phone} · ${customer.email}`,
      `Доставка: ${customer.delivery}`,
      config.shareUrl ? `Конфигурация: ${config.shareUrl}` : null,
    ].filter(Boolean);

    const text = lines.join("\n");
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      this.logger.log(`Новая заявка (Telegram не настроен):\n${text}`);
      return;
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        this.logger.warn(`Telegram ответил ${res.status} на заявку ${number}`);
      }
    } catch (err) {
      // Заявка уже сохранена — падение уведомления не должно ломать заказ.
      this.logger.warn(`Не удалось отправить заявку ${number} в Telegram: ${err}`);
    }
  }
}
