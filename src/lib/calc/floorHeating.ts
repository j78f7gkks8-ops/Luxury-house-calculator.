import { CalcError } from "./money";

/** Water underfloor heating - §14. */
export const FLOOR_HEATING = {
  pipePerM2: 7, // m/m2, approximate
  coilLengthM: 200,
  pricePerM: 40,
} as const;

export function pipeLengthForZoneM(areaM2: number, normPerM2 = FLOOR_HEATING.pipePerM2): number {
  if (areaM2 < 0) throw new CalcError("Отрицательная площадь зоны", "NEGATIVE_AREA");
  return areaM2 * normPerM2;
}

/**
 * A single loop cannot be spliced inside the screed, so it must be cut
 * entirely from one coil. Packing multiple loops onto shared coils is the
 * same bin-packing problem as timber cutting stock (§14, test #13: ten 60m
 * loops need 4 x 200m coils, not ceil(600/200)=3).
 */
export interface CoilPackResult {
  coilsUsed: number;
  bins: { loopLengthsM: number[]; usedM: number; wasteM: number }[];
  totalWasteM: number;
}

export function packLoopsIntoCoils(loopLengthsM: number[], coilLengthM = FLOOR_HEATING.coilLengthM): CoilPackResult {
  if (loopLengthsM.length === 0) {
    throw new CalcError("Список петель пуст", "EMPTY_LOOP_LIST");
  }
  for (const l of loopLengthsM) {
    if (l <= 0) throw new CalcError("Некорректная длина петли", "INVALID_LOOP_LENGTH");
    if (l > coilLengthM) {
      throw new CalcError(
        `Петля ${l} м превышает длину бухты ${coilLengthM} м - петля не может быть частично из другой бухты`,
        "LOOP_EXCEEDS_COIL",
      );
    }
  }
  const sorted = [...loopLengthsM].sort((a, b) => b - a);
  const bins: { loopLengthsM: number[]; usedM: number }[] = [];
  for (const len of sorted) {
    let placed = false;
    for (const bin of bins) {
      if (bin.usedM + len <= coilLengthM) {
        bin.loopLengthsM.push(len);
        bin.usedM += len;
        placed = true;
        break;
      }
    }
    if (!placed) bins.push({ loopLengthsM: [len], usedM: len });
  }
  const withWaste = bins.map((b) => ({ ...b, wasteM: coilLengthM - b.usedM }));
  return {
    coilsUsed: bins.length,
    bins: withWaste,
    totalWasteM: withWaste.reduce((s, b) => s + b.wasteM, 0),
  };
}

/** Lower bound only - not necessarily achievable (mirrors the cutting-stock module's honesty rule). */
export function lowerBoundCoils(totalLengthM: number, coilLengthM = FLOOR_HEATING.coilLengthM): number {
  return Math.ceil(totalLengthM / coilLengthM);
}

export function validateLoopLimit(loopLengthM: number, maxLoopM: number): { ok: boolean; message?: string } {
  if (loopLengthM > maxLoopM) {
    return {
      ok: false,
      message: `Петля ${loopLengthM} м превышает предел ${maxLoopM} м для выбранной схемы`,
    };
  }
  return { ok: true };
}

/** How the 3m manifold feed (подводка) is measured - §14: three explicit, non-interchangeable scopes. */
export type FeedScope = "TOTAL" | "PER_LOOP" | "ROUTE_BASED";

export interface FeedLengthInput {
  scope: FeedScope;
  loopCount: number;
  /** required for TOTAL: the stated total feed length for the whole system. */
  totalFeedM?: number;
  /** required for PER_LOOP: feed length per individual loop. */
  perLoopFeedM?: number;
  /** required for ROUTE_BASED: actual measured route lengths per loop, takes priority when known. */
  routeLengthsM?: number[];
}

export function feedLengthM(input: FeedLengthInput): number {
  if (input.loopCount <= 0) throw new CalcError("Число петель должно быть положительным", "INVALID_LOOP_COUNT");
  switch (input.scope) {
    case "TOTAL":
      if (input.totalFeedM === undefined) {
        throw new CalcError("Для TOTAL нужна суммарная длина подводки", "MISSING_TOTAL_FEED");
      }
      // TOTAL is the whole-system figure - it is NOT multiplied by loop count (§14 test #14).
      return input.totalFeedM;
    case "PER_LOOP":
      if (input.perLoopFeedM === undefined) {
        throw new CalcError("Для PER_LOOP нужна длина подводки на петлю", "MISSING_PER_LOOP_FEED");
      }
      return input.perLoopFeedM * input.loopCount;
    case "ROUTE_BASED":
      if (!input.routeLengthsM || input.routeLengthsM.length !== input.loopCount) {
        throw new CalcError(
          "Для ROUTE_BASED нужны измеренные трассы на каждую петлю",
          "MISSING_ROUTE_LENGTHS",
        );
      }
      return input.routeLengthsM.reduce((s, v) => s + v, 0);
  }
}

/** TOTAL-scope feed distributed across loops, explicitly or evenly as a marked estimate. */
export function distributeTotalFeed(
  totalFeedM: number,
  loopCount: number,
  explicitSharesM?: number[],
): { sharesM: number[]; isEstimate: boolean } {
  if (loopCount <= 0) throw new CalcError("Число петель должно быть положительным", "INVALID_LOOP_COUNT");
  if (explicitSharesM) {
    if (explicitSharesM.length !== loopCount) {
      throw new CalcError("Число долей подводки не совпадает с числом петель", "SHARE_COUNT_MISMATCH");
    }
    return { sharesM: explicitSharesM, isEstimate: false };
  }
  const even = totalFeedM / loopCount;
  return { sharesM: new Array(loopCount).fill(even), isEstimate: true };
}

/** Manifold (коллектор) outlet capacity check: 2 suitable connections per loop. */
export function manifoldOutletsRequired(loopCount: number, connectionsPerLoop = 2): number {
  return loopCount * connectionsPerLoop;
}

export function checkManifoldCapacity(availableOutlets: number, loopCount: number, connectionsPerLoop = 2) {
  const required = manifoldOutletsRequired(loopCount, connectionsPerLoop);
  return { ok: availableOutlets >= required, required, availableOutlets };
}
