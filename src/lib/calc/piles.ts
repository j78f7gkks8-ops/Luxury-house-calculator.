import { CalcError } from "./money";

/**
 * Pile/foundation calculation - §8 of the master prompt.
 *
 * Only the "confirmed template" regular-grid mode and the worked examples
 * from the spec are implemented generically here. Arbitrary polygon
 * inference ("universal safe step") is deliberately NOT attempted - the
 * prompt explicitly forbids it ("приложение не назначает универсальный
 * «безопасный шаг»"). A precise-scheme mode (importing real project
 * coordinates) and a manual-count-with-justification mode are the two other
 * modes described in §8; this module only models the shared arithmetic
 * (counting, merging, shifting) they all rely on.
 */

export interface PileGrid {
  /** "Across" axis pile coordinates, mm, from the template's stated origin. */
  xCoordsMm: number[];
  /** "Along" axis pile coordinates, mm. */
  yCoordsMm: number[];
}

/**
 * (число одинаковых соседних модулей + 1) × число опор вдоль модуля - valid
 * ONLY for the regular grid it was derived for. We simply expose grid
 * counting from explicit coordinates instead of a generic "safe" formula.
 */
export function gridPileCount(grid: PileGrid): number {
  if (grid.xCoordsMm.length === 0 || grid.yCoordsMm.length === 0) {
    throw new CalcError("Пустая сетка свай", "EMPTY_GRID");
  }
  return grid.xCoordsMm.length * grid.yCoordsMm.length;
}

/**
 * Enlarging a terrace moves the outer row of piles with the terrace edge;
 * piles under the living modules do not move. Modelled as: the moving row's
 * coordinate stays 0 relative to the (also moved) origin, while every other
 * row's coordinate grows by the same delta (§8, worked Barn 96 / Kyzyl example).
 */
export function shiftEdgeRow(coordsMm: number[], movingRowIndex: number, deltaMm: number): number[] {
  if (movingRowIndex < 0 || movingRowIndex >= coordsMm.length) {
    throw new CalcError("Индекс ряда вне диапазона сетки", "ROW_INDEX_OUT_OF_RANGE");
  }
  return coordsMm.map((x, i) => (i === movingRowIndex ? x : x + deltaMm));
}

/** Sum of connection spans in a rectangular pile lattice - used to show обвязка recalculates. */
export function bindingLengthMm(grid: PileGrid): number {
  const rowSpan = (coords: number[]) =>
    coords.slice(1).reduce((sum, v, i) => sum + (v - coords[i]!), 0);
  const xSpan = rowSpan(grid.xCoordsMm);
  const ySpan = rowSpan(grid.yCoordsMm);
  // every row of piles (one per Y) is connected along X, and vice versa
  return xSpan * grid.yCoordsMm.length + ySpan * grid.xCoordsMm.length;
}

/**
 * A named, explicit foundation-node variant for a fixture (e.g. a boiler-room
 * annex) that can either sit on its own independent piles or share a corner
 * pile with the main structure. The two variants must never be silently
 * mixed (§8): callers pick one by name.
 */
export interface PileVariant {
  name: string;
  pileCount: number;
  note: string;
}

export function independentFixturePiles(basePileCount: number, extraPileCount: number): PileVariant {
  return {
    name: "independent",
    pileCount: basePileCount + extraPileCount,
    note: "Пристройка на независимых сваях, не связана с основным полем",
  };
}

/** number of piles saved by sharing one corner node with the main structure - a distinct named variant, never auto-merged. */
export function sharedCornerFixturePiles(
  basePileCount: number,
  extraPileCount: number,
  sharedNodes: number,
): PileVariant {
  if (sharedNodes <= 0 || sharedNodes >= extraPileCount) {
    throw new CalcError("Некорректное число общих узлов", "INVALID_SHARED_NODES");
  }
  return {
    name: "shared-corner",
    pileCount: basePileCount + extraPileCount - sharedNodes,
    note: "Вариант общего угла - альтернатива независимому варианту, выбирается явно",
  };
}

/** Regular grid with a documented cutout: some nodes removed, some added at the cut. */
export function gridWithCutout(baseCount: number, removed: number, added: number): number {
  if (removed < 0 || added < 0 || removed > baseCount) {
    throw new CalcError("Некорректные параметры выреза сетки", "INVALID_CUTOUT");
  }
  return baseCount - removed + added;
}

/**
 * Merge only physically identical (exact-coordinate) support nodes. Close
 * coordinates are NOT proof of a shared pile (§8: "Близость координат не
 * доказывает общую сваю") - only an exact match collapses two node
 * references from crossing support lines into one physical pile.
 */
export interface PileNode {
  xMm: number;
  yMm: number;
}

export function dedupePileNodes(nodes: PileNode[]): PileNode[] {
  const seen = new Map<string, PileNode>();
  for (const n of nodes) {
    const key = `${n.xMm}:${n.yMm}`;
    if (!seen.has(key)) seen.set(key, n);
  }
  return Array.from(seen.values());
}

/** Fastening norms accepted by the owner (§8) - kept as named constants, not magic numbers. */
export const PILE_FASTENING_NORMS = {
  /** глухарь 12x120, per pile, attaching обвязка to a pile */
  bindingToPileBoltsPerPile: 4,
  /** глухарь 12x220, per module, attaching module to обвязка (previous Barn) */
  moduleToBindingBoltsPerModule: 25,
  /** шаг saмореза крепления стен к основанию модуля, mm - a distinct node, not to be summed with the above */
  wallToModuleBaseStepMm: 700,
} as const;
