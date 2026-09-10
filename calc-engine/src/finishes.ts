import { Decimal, d, Num, applyPercent } from "./decimal.js";

/** Раздел 11: плитка — геометрия покрываемых участков (душевой угол — не 1 м², а пол+стены). */
export interface TiledWall {
  lengthM: Num;
  heightM: Num;
}

export function tiledZoneAreaM2(floorM2: Num, walls: TiledWall[]): Decimal {
  const wallsArea = walls.reduce((acc, w) => acc.plus(d(w.lengthM).times(w.heightM)), d(0));
  return d(floorM2).plus(wallsArea);
}

/** Раздел 12: потолочное полотно 420 ₽/м² + резка 2% — процент применяется к цене полотна один раз. */
export function ceilingCanvasPricePerM2(basePricePerM2: Num, cuttingPct: Num = 2): Decimal {
  return applyPercent(basePricePerM2, cuttingPct);
}

/** Раздел 10: раскладка листов ЛДСП/OSB — площадь листа за вычетом кромки, простая метрика. */
export const LDSP_SHEET_WIDTH_M = 2.8;
export const LDSP_SHEET_HEIGHT_M = 2.07;
export const LDSP_SHEET_AREA_M2 = LDSP_SHEET_WIDTH_M * LDSP_SHEET_HEIGHT_M; // 5.796
export const LDSP_SHEET_PRICE = 6500;
export const LDSP_PACKAGE_FASTENER_PCT = 5;

export function ldspFastenerCost(materialCost: Num, pct: Num = LDSP_PACKAGE_FASTENER_PCT): Decimal {
  return applyPercent(materialCost, pct).minus(materialCost);
}

/** Раздел 23.1: раскрой металлических доборов — площадь листа × цена, крепёж отдельным процентом. */
export function metalTrimSheetCost(sheetCount: number, widthM: Num, lengthM: Num, pricePerM2: Num): Decimal {
  return d(sheetCount).times(widthM).times(lengthM).times(pricePerM2);
}

export function metalTrimFastenerCost(materialCost: Num, pct: Num = 5): Decimal {
  return applyPercent(materialCost, pct).minus(materialCost);
}
