import { Decimal, d, Num, applyPercent } from "./decimal.js";

/**
 * Раздел 10: плёнки Изоспан. Рулон 70 м², ширина 1,5 м, продольный нахлёст 0,1 м.
 * Общий сметный запас — 10%, без повторного процента на те же нахлёсты (раздел 23 п.9).
 */
export const IZOSPAN_ROLL_AREA_M2 = 70;
export const IZOSPAN_ROLL_WIDTH_M = 1.5;
export const IZOSPAN_LONGITUDINAL_OVERLAP_M = 0.1;
export const DEFAULT_FILM_RESERVE_PCT = 10;

export function areaWithReserve(baseAreaM2: Num, reservePct: Num = DEFAULT_FILM_RESERVE_PCT): Decimal {
  return applyPercent(baseAreaM2, reservePct);
}

/** Режим расхода: дробная доля рулона (для распределения между объектами до полного расходования). */
export function rollsFractional(areaM2: Num, rollAreaM2: Num = IZOSPAN_ROLL_AREA_M2): Decimal {
  return d(areaM2).dividedBy(rollAreaM2);
}

/** Режим закупки целыми рулонами: округление вверх, излишек считается отдельно. */
export function rollsWhole(areaM2: Num, rollAreaM2: Num = IZOSPAN_ROLL_AREA_M2): number {
  return d(areaM2).dividedBy(rollAreaM2).ceil().toNumber();
}

export function wholeRollSurplusM2(areaM2: Num, rollAreaM2: Num = IZOSPAN_ROLL_AREA_M2): Decimal {
  const whole = rollsWhole(areaM2, rollAreaM2);
  return d(whole).times(rollAreaM2).minus(areaM2);
}

// --- Скотч для плёнок: рулон 25 м, 950 ₽/рулон = 38 ₽/м расхода (Приложение А1) ---
export const TAPE_ROLL_LENGTH_M = 25;
export const TAPE_ROLL_PRICE = 950;
export const TAPE_CONSUMPTION_PRICE_PER_M = 38; // 950/25

export function tapeConsumptionCost(lengthM: Num, pricePerM: Num = TAPE_CONSUMPTION_PRICE_PER_M): Decimal {
  return d(lengthM).times(pricePerM);
}

export function tapeRollsWhole(lengthM: Num, rollLengthM: Num = TAPE_ROLL_LENGTH_M): number {
  return d(lengthM).dividedBy(rollLengthM).ceil().toNumber();
}

/**
 * Раздел 6 / 23.1: резерв применяется один раз. Позволяет отследить, что процент уже
 * учтён, и не даёт пересчитать его повторно (575→690, повторный пересчёт не даёт 828).
 */
export interface ReserveTrackedQuantity {
  baseValue: Decimal;
  reservePct: Decimal;
  reserveApplied: boolean;
  value: Decimal;
}

export function withReserve(baseValue: Num, reservePct: Num): ReserveTrackedQuantity {
  return {
    baseValue: d(baseValue),
    reservePct: d(reservePct),
    reserveApplied: true,
    value: applyPercent(baseValue, reservePct),
  };
}

export function reapplyReserve(tracked: ReserveTrackedQuantity, newReservePct: Num): ReserveTrackedQuantity {
  if (tracked.reserveApplied) {
    // раздел 23 п.9/п.21: запас уже применён — повторно не начисляем, возвращаем как есть
    return tracked;
  }
  return withReserve(tracked.baseValue, newReservePct);
}
