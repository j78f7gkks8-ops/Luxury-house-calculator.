import { Decimal, d, Num, toKopecks } from "./decimal.js";

/**
 * Раздел 11: остекление. Три исполнения: белое / антрацит снаружи / антрацит с двух сторон.
 * Все коэффициенты выводятся из исходных цен ДО скидки без предварительного округления
 * (раздел 11.2.3, 11.7): "не рассчитывай итог через округлённую экранную цену".
 */

export type Finish = "white" | "outside" | "both";
export type WindowShape = "rect" | "trapezoid";

export interface FinishPriceSet {
  white: Num;
  outside: Num;
  both: Num;
}

export interface WindowReferenceProduct {
  id: string;
  name: string;
  kind: "window" | "door";
  shape: WindowShape;
  widthMm: number;
  heightMm: number; // для rect; для trapezoid — не используется напрямую
  heightLeftMm?: number; // для trapezoid
  heightRightMm?: number; // для trapezoid
  beforeDiscount: FinishPriceSet;
  discountFraction: Num; // 0.26 = 26%
}

export function priceAfterDiscount(priceBeforeDiscount: Num, discountFraction: Num): Decimal {
  return d(priceBeforeDiscount).times(d(1).minus(discountFraction));
}

/** K_белое=1, K_снаружи, K_две_стороны — из исходных цен ДО скидки (раздел 11.2.3). */
export function finishCoefficients(beforeDiscount: FinishPriceSet): { white: Decimal; outside: Decimal; both: Decimal } {
  const white = d(beforeDiscount.white);
  return {
    white: d(1),
    outside: d(beforeDiscount.outside).dividedBy(white),
    both: d(beforeDiscount.both).dividedBy(white),
  };
}

export function rectAreaM2(widthMm: Num, heightMm: Num): Decimal {
  return d(widthMm).dividedBy(1000).times(d(heightMm).dividedBy(1000));
}

/** A = W × (H_лев + H_прав) / 2, все переведены в метры (раздел 11.3.2). */
export function trapezoidAreaM2(widthMm: Num, heightLeftMm: Num, heightRightMm: Num): Decimal {
  const wM = d(widthMm).dividedBy(1000);
  const hLm = d(heightLeftMm).dividedBy(1000);
  const hRm = d(heightRightMm).dividedBy(1000);
  return wM.times(hLm.plus(hRm).dividedBy(2));
}

export function productAreaM2(p: {
  shape: WindowShape;
  widthMm: Num;
  heightMm?: Num;
  heightLeftMm?: Num;
  heightRightMm?: Num;
}): Decimal {
  if (p.shape === "trapezoid") {
    if (p.heightLeftMm === undefined || p.heightRightMm === undefined) {
      throw new Error("trapezoid area requires heightLeftMm and heightRightMm");
    }
    return trapezoidAreaM2(p.widthMm, p.heightLeftMm, p.heightRightMm);
  }
  if (p.heightMm === undefined) throw new Error("rect area requires heightMm");
  return rectAreaM2(p.widthMm, p.heightMm);
}

/** Приоритет 1 (раздел 11.3.1): точная конфигурация есть в каталоге — берём цену как есть. */
export function exactCatalogPrice(product: WindowReferenceProduct, finish: Finish): Decimal {
  return toKopecks(priceAfterDiscount(product.beforeDiscount[finish], product.discountFraction));
}

export interface ResizeEstimateInput {
  referenceProduct: WindowReferenceProduct;
  /** Исполнение эталона, от которого отталкивается расчёт (может быть уже цветным). */
  referenceFinish: Finish;
  targetFinish: Finish;
  newWidthMm: number;
  newHeightMm?: number;
  newShape?: WindowShape;
  newHeightLeftMm?: number;
  newHeightRightMm?: number;
}

export interface ResizeEstimateResult {
  areaRefM2: Decimal;
  areaNewM2: Decimal;
  sizeCoefficient: Decimal;
  priceBeforeRounding: Decimal;
  price: Decimal;
  status: "preliminary_by_analog";
}

/**
 * Раздел 11.3.2: предварительная оценка цены при изменении размера изделия того же
 * конструктивного типа. Если эталон уже цветной и целевое исполнение совпадает — второй
 * коэффициент кашировки не нужен (11.3.3, последний абзац). Переключение
 * "снаружи → две стороны" реализовано как частный случай (K_size=1) и даёт точную
 * двустороннюю цену, а не одностороннюю × коэффициент от белого (раздел 11.2.3).
 */
export function estimateResizedWindowPrice(input: ResizeEstimateInput): ResizeEstimateResult {
  const ref = input.referenceProduct;
  const areaRef = productAreaM2(ref);
  const newShape = input.newShape ?? ref.shape;
  const areaNew = productAreaM2({
    shape: newShape,
    widthMm: input.newWidthMm,
    heightMm: input.newHeightMm,
    heightLeftMm: input.newHeightLeftMm,
    heightRightMm: input.newHeightRightMm,
  });
  const sizeCoefficient = areaNew.dividedBy(areaRef);
  const coeffs = finishCoefficients(ref.beforeDiscount);

  let priceBeforeRounding: Decimal;

  if (input.referenceFinish === "white") {
    const priceNewWhite = priceAfterDiscount(ref.beforeDiscount.white, ref.discountFraction).times(sizeCoefficient);
    const targetCoeff = coeffs[input.targetFinish];
    priceBeforeRounding = priceNewWhite.times(targetCoeff);
  } else {
    const refColoredAfterDiscount = priceAfterDiscount(ref.beforeDiscount[input.referenceFinish], ref.discountFraction);
    if (input.targetFinish === input.referenceFinish) {
      priceBeforeRounding = refColoredAfterDiscount.times(sizeCoefficient);
    } else {
      const refFinishCoeff = coeffs[input.referenceFinish];
      const priceNewWhite = refColoredAfterDiscount.dividedBy(refFinishCoeff).times(sizeCoefficient);
      priceBeforeRounding = priceNewWhite.times(coeffs[input.targetFinish]);
    }
  }

  return {
    areaRefM2: areaRef,
    areaNewM2: areaNew,
    sizeCoefficient,
    priceBeforeRounding,
    price: toKopecks(priceBeforeRounding),
    status: "preliminary_by_analog",
  };
}

// --- Раздел 11.2: комплект W1-W4 + D1 (три сопоставимых предложения) ---

export const STANDARD_WINDOW_CATALOG: WindowReferenceProduct[] = [
  {
    id: "W1",
    name: "Окно 2100×2200, три секции, средняя открывается",
    kind: "window",
    shape: "rect",
    widthMm: 2100,
    heightMm: 2200,
    discountFraction: 0.26,
    beforeDiscount: { white: 38691.34, outside: 46912.46, both: 62280.59 },
  },
  {
    id: "W2",
    name: "Окно 1500×1500, две секции, одна открывается",
    kind: "window",
    shape: "rect",
    widthMm: 1500,
    heightMm: 1500,
    discountFraction: 0.26,
    beforeDiscount: { white: 22280.33, outside: 27358.57, both: 36464.94 },
  },
  {
    id: "W3",
    name: "Окно 1200×2200, глухое",
    kind: "window",
    shape: "rect",
    widthMm: 1200,
    heightMm: 2200,
    discountFraction: 0.26,
    beforeDiscount: { white: 17160.17, outside: 20233.57, both: 25754.87 },
  },
  {
    id: "W4",
    name: "Окно 700×1500, открывающееся",
    kind: "window",
    shape: "rect",
    widthMm: 700,
    heightMm: 1500,
    discountFraction: 0.26,
    beforeDiscount: { white: 14030.72, outside: 17455.75, both: 23431.55 },
  },
  {
    id: "D1",
    name: "Входная остеклённая дверь 1000×2100",
    kind: "door",
    shape: "rect",
    widthMm: 1000,
    heightMm: 2100,
    discountFraction: 0.26,
    beforeDiscount: { white: 46087.29, outside: 48081.1, both: 55210.12 },
  },
];

export const STANDARD_CATALOG_QUANTITY: Record<string, number> = { W1: 1, W2: 3, W3: 1, W4: 2, D1: 1 };

/**
 * Раздел 11.7: "сначала сумма исходных позиций, затем скидка, затем округление до копеек".
 * НЕ округлять построчно перед суммированием — иначе контрольные итоги не совпадут.
 */
export function invoiceTotalAfterDiscount(
  lines: { unitPriceBeforeDiscount: Num; qty: number }[],
  discountFraction: Num
): Decimal {
  const rawTotal = lines.reduce((acc, l) => acc.plus(d(l.unitPriceBeforeDiscount).times(l.qty)), d(0));
  return toKopecks(rawTotal.times(d(1).minus(discountFraction)));
}

export function invoiceTotalByFinish(
  catalog: WindowReferenceProduct[],
  quantities: Record<string, number>,
  finish: Finish,
  discountFraction: Num = 0.26
): Decimal {
  const lines = catalog
    .filter((p) => quantities[p.id])
    .map((p) => ({ unitPriceBeforeDiscount: p.beforeDiscount[finish], qty: quantities[p.id] }));
  return invoiceTotalAfterDiscount(lines, discountFraction);
}

// --- Раздел 11.4: панорамное остекление Барн 108 (отдельный источник, не связан с W1-W4/D1) ---

export interface PanoramicProduct {
  id: string;
  name: string;
  beforeDiscount: Num;
}

export const BARN108_PANORAMIC_PRODUCTS: Record<string, PanoramicProduct> = {
  P1: { id: "P1", name: "Глухое прямоугольное окно 1650×2050", beforeDiscount: 21434.72 },
  P2: { id: "P2", name: "Входная остеклённая дверь 1000×2050", beforeDiscount: 46984.38 },
  P3: { id: "P3", name: "Открывающееся окно 1000×2050", beforeDiscount: 25823.05 },
  P4: { id: "P4", name: "Глухая широкая трапеция (ширина 1650; высоты 419/675)", beforeDiscount: 14553.65 },
  P5: { id: "P5", name: "Глухая узкая трапеция (ширина 1000; высоты 250/390)", beforeDiscount: 7696.45 },
};

export const BARN108_DISCOUNT = 0.26;

/** Блок с входной дверью: P1+P2+P4+P5, по одному экземпляру каждого. */
export const BARN108_DOOR_BLOCK: Record<string, number> = { P1: 1, P2: 1, P4: 1, P5: 1 };
/** Блок с открывающимся окном: P1+P3+P4+P5. */
export const BARN108_WINDOW_BLOCK: Record<string, number> = { P1: 1, P3: 1, P4: 1, P5: 1 };
/** Исходное предложение — два фасадных блока (один с дверью, один с окном) = 8 изделий. */
export const BARN108_ORIGINAL_INVOICE: Record<string, number> = { P1: 2, P2: 1, P3: 1, P4: 2, P5: 2 };

export function barn108BlockTotal(quantities: Record<string, number>): Decimal {
  const lines = Object.entries(quantities).map(([id, qty]) => ({
    unitPriceBeforeDiscount: BARN108_PANORAMIC_PRODUCTS[id].beforeDiscount,
    qty,
  }));
  return invoiceTotalAfterDiscount(lines, BARN108_DISCOUNT);
}

/**
 * Раздел 11.4: "Итоги здесь — сумма исходного округлённого счёта и округлённой оценки
 * дополнительного блока" — т.е. складываются уже округлённые суммы, а не пересчитывается
 * скидка на объединённый черновой итог (иначе получится другое число из-за округления).
 */
export function addRoundedTotals(...amounts: Num[]): Decimal {
  return toKopecks(amounts.reduce((acc: Decimal, a) => acc.plus(d(a)), d(0)));
}

export function barn108TotalAreaM2(): Decimal {
  // P1: 1650×2050 ×2шт, P2: 1000×2050, P3: 1000×2050, P4 трапеция ×2, P5 трапеция ×2
  const p1 = rectAreaM2(1650, 2050).times(2);
  const p2 = rectAreaM2(1000, 2050);
  const p3 = rectAreaM2(1000, 2050);
  const p4 = trapezoidAreaM2(1650, 419, 675).times(2);
  const p5 = trapezoidAreaM2(1000, 250, 390).times(2);
  return p1.plus(p2).plus(p3).plus(p4).plus(p5);
}
