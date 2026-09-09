import { CalcError } from "./money";

/** Izospan A/B/AM vapour/wind films - §10. */
export const IZOSPAN = {
  rollWidthM: 1.5,
  rollAreaM2: 70,
  longitudinalOverlapM: 0.1,
} as const;

function assertNonNegativeArea(areaM2: number) {
  if (!Number.isFinite(areaM2) || areaM2 < 0) {
    throw new CalcError("Отрицательная или нулевая площадь недопустима", "NEGATIVE_AREA");
  }
}

/**
 * Simple mode: one flat reserve applied once to the base area. Must NOT be
 * combined with the detailed layout's own geometric overlap reserve (§10,
 * test #9: 100 m² at 10% -> 110 m², never 121 m²).
 */
export function simpleReserveAreaM2(baseAreaM2: number, reserveFraction = 0.1): number {
  assertNonNegativeArea(baseAreaM2);
  return baseAreaM2 * (1 + reserveFraction);
}

/** Pay only for consumed area, fractional roll share. */
export function rollsFractional(areaM2: number): number {
  assertNonNegativeArea(areaM2);
  return areaM2 / IZOSPAN.rollAreaM2;
}

/** Whole-roll purchase mode: rounds stock up, tracks surplus separately (not "installed material"). */
export function rollsWholePurchase(areaM2: number): { rolls: number; surplusM2: number } {
  assertNonNegativeArea(areaM2);
  const rolls = Math.ceil(areaM2 / IZOSPAN.rollAreaM2);
  const surplusM2 = rolls * IZOSPAN.rollAreaM2 - areaM2;
  return { rolls, surplusM2 };
}

/**
 * Detailed layout: strips of roll width with a real longitudinal overlap
 * between adjacent strips. Returns the raw material area BEFORE any
 * separate reserve is applied - the caller adds their own reserve
 * explicitly (§10: "не складывать молча 10% и ещё процент на те же нахлёсты").
 */
export function detailedLayoutAreaM2(
  surfaceWidthM: number,
  surfaceHeightM: number,
): { stripCount: number; materialAreaM2: number } {
  if (surfaceWidthM <= 0 || surfaceHeightM <= 0) {
    throw new CalcError("Отрицательная или нулевая площадь недопустима", "NEGATIVE_AREA");
  }
  const effectiveStripWidthM = IZOSPAN.rollWidthM - IZOSPAN.longitudinalOverlapM;
  const stripCount =
    surfaceWidthM <= IZOSPAN.rollWidthM
      ? 1
      : 1 + Math.ceil((surfaceWidthM - IZOSPAN.rollWidthM) / effectiveStripWidthM);
  const materialAreaM2 = stripCount * IZOSPAN.rollWidthM * surfaceHeightM;
  return { stripCount, materialAreaM2 };
}

/** Apply a reserve fraction on top of an already-computed material area (a single, explicit step). */
export function applyReserve(materialAreaM2: number, reserveFraction: number): number {
  assertNonNegativeArea(materialAreaM2);
  return materialAreaM2 * (1 + reserveFraction);
}

/** Tape (скотч): length consumed from seams/joints, roll = 25m. */
export const SEAM_TAPE_ROLL_LENGTH_M = 25;

export function tapeRollsWholePurchase(consumedLengthM: number): { rolls: number; surplusM: number } {
  if (consumedLengthM < 0) {
    throw new CalcError("Отрицательная длина скотча недопустима", "NEGATIVE_LENGTH");
  }
  const rolls = Math.ceil(consumedLengthM / SEAM_TAPE_ROLL_LENGTH_M);
  return { rolls, surplusM: rolls * SEAM_TAPE_ROLL_LENGTH_M - consumedLengthM };
}
