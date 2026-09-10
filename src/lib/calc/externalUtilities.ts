import { CalcError } from "./money";

/**
 * External utilities - §15. Every length here is a distinct physical run:
 * drilling depth, pump suspension depth, the pipe inside the borehole, the
 * distance to the house, the rise to the distributor and the insulated
 * section are six different numbers, and the spec is explicit that none of
 * them may be derived from another ("Не считать глубину бурения равной
 * глубине утепления или длине греющего кабеля").
 */

export interface WellInput {
  /** Depth actually drilled, m - priced per metre, drives nothing else. */
  drillDepthM: number;
  /** How deep the pump hangs, m - can be less than the drilled depth. */
  pumpSuspensionDepthM: number;
  /** Horizontal distance from the borehole to the house, m. */
  distanceToHouseM: number;
  /** Rise from the entry point up to the distributor inside, m. */
  riseToDistributorM: number;
  /**
   * How far down the borehole the insulation goes, m. In the worked example
   * this is 2 m, while the borehole itself is 16 or 30 m deep.
   */
  insulatedDepthIntoWellM: number;
}

export interface WellLengths {
  drillDepthM: number;
  /** PND pipe: down to the pump, along the ground, then up to the distributor. */
  pipeLengthM: number;
  /**
   * Insulated (and heat-traced) section only: down into the well + along the
   * ground + the rise. §15 worked example: 2 + 4 + 2 = 8 m, NOT the 16 or 30 m
   * of the borehole.
   */
  insulatedLengthM: number;
  /** Trench along the ground between well and house. */
  trenchLengthM: number;
}

export function wellLengths(input: WellInput): WellLengths {
  for (const [name, value] of Object.entries(input)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new CalcError(`Некорректная длина "${name}" для скважины`, "INVALID_WELL_LENGTH", { name });
    }
  }
  if (input.pumpSuspensionDepthM > input.drillDepthM) {
    throw new CalcError(
      "Насос не может висеть глубже пробуренной скважины",
      "PUMP_DEEPER_THAN_WELL",
    );
  }
  if (input.insulatedDepthIntoWellM > input.drillDepthM) {
    throw new CalcError(
      "Утеплённый участок в скважине не может быть глубже самой скважины",
      "INSULATION_DEEPER_THAN_WELL",
    );
  }

  return {
    drillDepthM: input.drillDepthM,
    pipeLengthM: input.pumpSuspensionDepthM + input.distanceToHouseM + input.riseToDistributorM,
    insulatedLengthM:
      input.insulatedDepthIntoWellM + input.distanceToHouseM + input.riseToDistributorM,
    trenchLengthM: input.distanceToHouseM,
  };
}

export interface SepticInput {
  /** Distance from the house to the septic, m - an object parameter, not a constant. */
  distanceFromHouseM: number;
  /** Number of concrete rings in the chosen configuration. */
  ringCount: number;
}

export interface SepticLengths {
  /** Outside sewer run from the house to the septic. */
  sewerRunM: number;
  trenchLengthM: number;
  ringCount: number;
}

export function septicLengths(input: SepticInput): SepticLengths {
  if (input.distanceFromHouseM < 0 || input.ringCount <= 0) {
    throw new CalcError("Некорректные параметры септика", "INVALID_SEPTIC_INPUT");
  }
  return {
    sewerRunM: input.distanceFromHouseM,
    trenchLengthM: input.distanceFromHouseM,
    ringCount: input.ringCount,
  };
}

/**
 * A trench shared by two routes is dug once (§15: "Общую траншею двух трасс
 * считать по объединённым участкам один раз"). Runs are given as intervals of
 * distance from the house so overlapping sections merge instead of summing.
 */
export interface TrenchRun {
  name: string;
  fromM: number;
  toM: number;
}

export function mergedTrenchLengthM(runs: TrenchRun[]): number {
  const normalized = runs
    .map((r) => {
      if (r.toM < r.fromM) {
        throw new CalcError(`Участок траншеи "${r.name}" задан наоборот`, "INVALID_TRENCH_RUN", {
          name: r.name,
        });
      }
      return { from: r.fromM, to: r.toM };
    })
    .sort((a, b) => a.from - b.from);

  let total = 0;
  let cursor: { from: number; to: number } | null = null;
  for (const run of normalized) {
    if (!cursor) {
      cursor = { ...run };
      continue;
    }
    if (run.from <= cursor.to) {
      cursor.to = Math.max(cursor.to, run.to);
    } else {
      total += cursor.to - cursor.from;
      cursor = { ...run };
    }
  }
  if (cursor) total += cursor.to - cursor.from;
  return total;
}

/** Sum of separate runs, for comparison against the merged figure. */
export function naiveTrenchLengthM(runs: TrenchRun[]): number {
  return runs.reduce((s, r) => s + (r.toM - r.fromM), 0);
}
