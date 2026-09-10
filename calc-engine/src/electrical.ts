import { Decimal, d, Num, applyPercent } from "./decimal.js";

/**
 * Раздел 13/23.1: электрика. Резерв применяется один раз к исходной длине; кабели и гофра —
 * раздельные категории, их суммы не смешиваются (690 м кабеля ≠ 680,4 м гофры).
 */
export interface CableRun {
  label: string;
  baseLengthM: Num;
}

export function cableLengthWithReserve(baseLengthM: Num, reservePct: Num = 20): Decimal {
  return applyPercent(baseLengthM, reservePct);
}

export function totalCableLength(runs: CableRun[], reservePct: Num = 20): Decimal {
  const base = runs.reduce((acc, r) => acc.plus(r.baseLengthM), d(0));
  return applyPercent(base, reservePct);
}

export interface CorrugatedTubeRun {
  diameterLabel: string;
  baseLengthM: Num;
}

export function totalCorrugatedTubeLength(runs: CorrugatedTubeRun[], reservePct: Num = 20): { byDiameter: Record<string, Decimal>; total: Decimal } {
  const byDiameter: Record<string, Decimal> = {};
  let total = d(0);
  for (const r of runs) {
    const withReserve = applyPercent(r.baseLengthM, reservePct);
    byDiameter[r.diameterLabel] = withReserve;
    total = total.plus(withReserve);
  }
  return { byDiameter, total };
}

/** Электрощит: сумма занимаемых модулей аппаратов + резерв не должна превышать вместимость. */
export function panelCapacityCheck(occupiedModules: number, panelCapacityModules: number): { fits: boolean; freeModules: number } {
  return { fits: occupiedModules <= panelCapacityModules, freeModules: panelCapacityModules - occupiedModules };
}
