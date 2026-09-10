import { Decimal, d, Num } from "./decimal.js";
import { cutParts } from "./cutting.js";

/** Раздел 14: предварительная мощность котла по норме владельца. Не заменяет расчёт теплопотерь. */
export function preliminaryBoilerPowerKw(heatedAreaM2: Num, normKwPerM2: Num = 0.1): Decimal {
  return d(heatedAreaM2).times(normKwPerM2);
}

export const SCREED_PRICE_PER_M2 = 1700;
export const PE_FILM_PRICE_PER_M2 = 50;
export const MESH_PRICE_PER_M2 = 200;
export const PIPE_LENGTH_PER_M2 = 7; // ориентировочно 7 м/м²
export const PIPE_COIL_LENGTH_M = 200;
export const PIPE_PRICE_PER_M = 40;

export function pipeLengthForArea(areaM2: Num, normMPerM2: Num = PIPE_LENGTH_PER_M2): Decimal {
  return d(areaM2).times(normMPerM2);
}

/**
 * Раскрой бухт на цельные петли без стыков внутри стяжки (раздел 14): это тот же
 * одномерный bin-packing, что и для пиломатериала, только без пропила. Пример: 10 петель
 * по 60 м требуют 4 бухты по 200 м (не ceil(600/200)=3 — петли нельзя резать на стыке бухт).
 */
export function packLoopsIntoCoils(loopLengthsM: number[], coilLengthM: Num = PIPE_COIL_LENGTH_M) {
  const parts = loopLengthsM.map((len, i) => ({ id: `loop_${i}`, lengthMm: len, qty: 1 }));
  return cutParts(parts, { stockLengthMm: d(coilLengthM).toNumber(), kerfMm: 0 });
}

/** Историческая норма подготовки пола/намотки труб: 2×1.5×10=30 человеко-часов при 550 ₽/ч. */
export function floorPrepHumanHours(people: number, days: number, hoursPerDay: number): Decimal {
  return d(people).times(days).times(hoursPerDay);
}

export type CollectorFeedScope = "TOTAL" | "PER_LOOP" | "ROUTE_BASED";

export interface CollectorFeedInput {
  scope: CollectorFeedScope;
  /** Для TOTAL: суммарная длина подводки на систему (по умолчанию 3 м — раздел 14). */
  totalLengthM?: Num;
  /** Для PER_LOOP: длина подводки на одну петлю. */
  perLoopLengthM?: Num;
  loopCount?: number;
  /** Для ROUTE_BASED: реальная измеренная длина трассы. */
  routeLengthM?: Num;
}

/**
 * Раздел 14/23 п.14: подводка 3 м TOTAL не становится 3×число петель. Режим PER_LOOP
 * даёт явно другой результат, и оба должны быть поддержаны с подписанным источником.
 */
export function collectorFeedLength(input: CollectorFeedInput): Decimal {
  switch (input.scope) {
    case "TOTAL":
      return d(input.totalLengthM ?? 3);
    case "PER_LOOP":
      if (input.loopCount === undefined || input.perLoopLengthM === undefined) {
        throw new Error("PER_LOOP requires perLoopLengthM and loopCount");
      }
      return d(input.perLoopLengthM).times(input.loopCount);
    case "ROUTE_BASED":
      if (input.routeLengthM === undefined) throw new Error("ROUTE_BASED requires routeLengthM");
      return d(input.routeLengthM);
  }
}

export interface LoopLimitCheck {
  loopLengthM: Decimal;
  limitM: Decimal;
  exceeds: boolean;
}

/** Ни одна петля не должна превышать выбранный предел без явного статуса ошибки. */
export function checkLoopLimit(loopLengthM: Num, limitM: Num = 60): LoopLimitCheck {
  const loop = d(loopLengthM);
  const limit = d(limitM);
  return { loopLengthM: loop, limitM: limit, exceeds: loop.gt(limit) };
}
