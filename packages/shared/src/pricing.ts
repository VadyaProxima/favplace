import type { MaterialType } from "./index";

/**
 * classic = lion GLB signet, mountain = continuous plateau,
 * disc / plug = procedural cylinder inserts,
 * bar = rectangular insert spanning band width,
 * square / circle / oval = basic_ring.glb empty faces + relief
 */
export type RingForm =
  | "classic"
  | "mountain"
  | "disc"
  | "plug"
  | "bar"
  | "square"
  | "circle"
  | "oval";

export type ReliefDetail = "low" | "medium" | "high";

/**
 * Формы, которые сейчас можно выбрать. Список проверяет ссылки-конфигурации:
 * ?form= со скрытой формой не пройдёт, и конструктор откроется на форме
 * по умолчанию. Тип RingForm и цены ниже намеренно оставлены полными —
 * вьюеры скрытых форм рабочие, вернуть их можно расстановкой комментариев.
 */
export const RING_FORMS: RingForm[] = [
  // "classic",
  "mountain",
  // "disc",
  // "plug",
  // "bar",
  "square",
  "circle",
  "oval",
];

/**
 * Базовая цена формы — за изделие из серебра со средней детализацией.
 * ВНИМАНИЕ: цифры предварительные, их нужно свести с реальной
 * себестоимостью литья до запуска приёма заказов.
 */
export const RING_FORM_BASE_PRICE: Record<RingForm, number> = {
  classic: 17200,
  mountain: 16400,
  disc: 15900,
  plug: 16900,
  bar: 15400,
  square: 14900,
  circle: 14900,
  oval: 14900,
};

/** Множитель металла к базовой цене формы. */
export const MATERIAL_PRICE_FACTOR: Record<MaterialType, number> = {
  silver: 1,
  gold: 4.2,
  platinum: 5.6,
};

/** Доплата за плотность сетки рельефа (дольше доводка мастером). */
export const RELIEF_DETAIL_SURCHARGE: Record<ReliefDetail, number> = {
  low: 0,
  medium: 900,
  high: 1800,
};

export const RELIEF_DETAIL_LABELS: Record<ReliefDetail, string> = {
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая",
};

/** Гравировка внутри шинки. */
export const ENGRAVING_PRICE = 500;

/** Двухцветная отделка: полированная шинка + светлый рельеф. */
export const TWO_TONE_PRICE = 2400;

/** Максимальная длина гравировки, символов. */
export const ENGRAVING_MAX_LENGTH = 30;

/** Внутренние диаметры шинки в мм. */
export const RING_SIZES_MM: number[] = Array.from(
  { length: 17 },
  (_, i) => 15 + i * 0.5,
);

/** Длина окружности пальца по внутреннему диаметру, мм. */
export function ringCircumference(diameterMm: number): number {
  return Math.PI * diameterMm;
}

/** Внутренний диаметр по замеренной длине окружности, мм. */
export function ringDiameterFromCircumference(circumferenceMm: number): number {
  return circumferenceMm / Math.PI;
}

/** Ближайший доступный размер к произвольному диаметру. */
export function nearestRingSize(diameterMm: number): number {
  return RING_SIZES_MM.reduce((best, size) =>
    Math.abs(size - diameterMm) < Math.abs(best - diameterMm) ? size : best,
  );
}

export interface PriceInput {
  ringForm: RingForm;
  material: MaterialType;
  reliefDetail: ReliefDetail;
  engraving?: string;
  twoTone?: boolean;
}

export interface PriceLine {
  label: string;
  amount: number;
}

export interface PriceBreakdown {
  lines: PriceLine[];
  total: number;
}

/**
 * Единая точка расчёта цены — используется и на фронте (превью),
 * и на бэке (проверка суммы заявки).
 */
export function calcPrice(input: PriceInput): PriceBreakdown {
  const base = Math.round(
    RING_FORM_BASE_PRICE[input.ringForm] *
      MATERIAL_PRICE_FACTOR[input.material],
  );

  const lines: PriceLine[] = [{ label: "Изделие", amount: base }];

  const detail = RELIEF_DETAIL_SURCHARGE[input.reliefDetail];
  if (detail > 0) {
    lines.push({
      label: `Детализация: ${RELIEF_DETAIL_LABELS[input.reliefDetail].toLowerCase()}`,
      amount: detail,
    });
  }

  if (input.twoTone) {
    lines.push({ label: "Двухцветная отделка", amount: TWO_TONE_PRICE });
  }

  if (input.engraving && input.engraving.trim().length > 0) {
    lines.push({ label: "Гравировка", amount: ENGRAVING_PRICE });
  }

  return {
    lines,
    total: lines.reduce((sum, l) => sum + l.amount, 0),
  };
}

/** «17 200 ₽» */
export function formatPrice(amount: number): string {
  return `${Math.round(amount).toLocaleString("ru-RU")} ₽`;
}

/** «от 14 900 ₽» — минимум по форме, серебро, низкая детализация. */
export function formFromPrice(form: RingForm): number {
  return calcPrice({
    ringForm: form,
    material: "silver",
    reliefDetail: "low",
  }).total;
}
