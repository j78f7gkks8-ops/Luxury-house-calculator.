import { Decimal, d, Num } from "./decimal.js";

/**
 * Раздел 8: сваи и фундамент. Реализованы три обязательных примера приёмки (раздел 23,
 * пункты 5-7): Барн 96/Кызыл (сдвиг террасы), независимая кочегарка, "Орбита", Норма 77.
 * Общая формула "(N одинаковых модулей + 1) × опор вдоль" НЕ обобщается на произвольный
 * многоугольник — здесь она применяется только к явно регулярной сетке через xs×ys.
 */

export interface RegularPileGrid {
  /** Координаты вдоль одной оси, мм, от произвольного фиксированного начала отсчёта. */
  xsMm: number[];
  ysMm: number[];
}

export function gridPileCount(grid: RegularPileGrid): number {
  return grid.xsMm.length * grid.ysMm.length;
}

/**
 * Раздел 8 / 23.5: увеличение террасы Барна 96/Кызыл с 2 до 3 м. Координаты документа даны
 * в системе отсчёта "от края террасы", поэтому при увеличении глубины террасы все значения
 * увеличиваются на дельту — физически смещается только внешний ряд свай (проверяется через
 * повторную привязку к общему для дома началу отсчёта: reanchorToBuildingFrame).
 */
export const BARN96_KYZYL_ACROSS_BEFORE_MM = [0, 1900, 4900, 7900, 10800];
export const BARN96_KYZYL_ACROSS_AFTER_MM = [0, 2900, 5900, 8900, 11800];
export const BARN96_KYZYL_ALONG_MM = [0, 1867, 3733, 5600, 7800];

/** Пересчитывает координаты от новой системы отсчёта обратно к прежнему фиксированному краю дома. */
export function reanchorToBuildingFrame(coordsMm: number[], terraceDepthDeltaMm: number): number[] {
  return coordsMm.map((c) => c - terraceDepthDeltaMm);
}

export interface FoundationJointVariant {
  name: string;
  uniquePileCount: number;
  note: string;
}

/**
 * Раздел 8: независимая кочегарка на 4 отдельных сваях (25+4=29) против варианта с общим
 * узлом на углу (28 уникальных мест). Варианты хранятся раздельно — "нельзя смешивать без
 * выбора узла".
 */
export function kotelnayaJointVariants(basePileCount: number): FoundationJointVariant[] {
  return [
    {
      name: "independent_4_piles",
      uniquePileCount: basePileCount + 4,
      note: "Кочегарка на четырёх независимых сваях, без общих узлов с основным полем.",
    },
    {
      name: "shared_corner_node",
      uniquePileCount: basePileCount + 3,
      note: "Одна свая общая с основным полем через угловой узел — итого на 1 меньше суммы.",
    },
  ];
}

/** Раздел 8/23.7: поле "Орбита" — регулярная сетка 20, одна убрана, пять добавлены в вырезе. */
export function applyGridExceptions(baseCount: number, removed: number, added: number): number {
  return baseCount - removed + added;
}

export const ORBITA_BASE_GRID = 20;
export const ORBITA_REMOVED = 1;
export const ORBITA_ADDED = 5;

/** Раздел 8: Норма 77 — 6×4 = 24 опоры (15 под жилой частью, 5 передний ряд, 4 боковой). */
export const NORMA77_XS_MM = [0, 2925, 5031, 7138, 9244, 11350];
export const NORMA77_YS_MM = [0, 2925, 5925, 8850];

// --- Крепёж фундамента (раздел 8) ---

export const LAG_BOLTS_PER_PILE_TO_BEAM = 4; // 4 глухаря 12×120 на сваю (обвязка к свае)
export const LAG_BOLTS_PER_MODULE_TO_BEAM_HISTORICAL = 25; // 25 глухарей 12×220 на модуль (прежний Барн)

export function beamToPileFastenerCount(pileCount: number): number {
  return pileCount * LAG_BOLTS_PER_PILE_TO_BEAM;
}

export function moduleToBeamFastenerCount(moduleCount: number, perModule = LAG_BOLTS_PER_MODULE_TO_BEAM_HISTORICAL): number {
  return moduleCount * perModule;
}

// --- Материалы свай по чеку (раздел 23.1: "27 винтовых свай второго типа и 27 оголовков") ---

export function pileFoundationMaterialsCost(quantity: number, unitPileAfterDiscount: Num, unitHeadAfterDiscount: Num): Decimal {
  return d(unitPileAfterDiscount).plus(unitHeadAfterDiscount).times(quantity);
}

// Приложение А6: свая винтовая D89×3,5 L3000 3608.40 после 7%; оголовок сваи 511.50 после 7%.
export const SCREW_PILE_D89_L3000_AFTER_DISCOUNT = 3608.4;
export const PILE_HEAD_AFTER_DISCOUNT = 511.5;
