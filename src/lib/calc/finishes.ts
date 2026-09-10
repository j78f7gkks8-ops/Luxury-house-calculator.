import { CalcError, money, Money } from "./money";

/** Tile zone area: floor + walls to a given height, own geometry per zone (§11). */
export interface TileZone {
  floorAreaM2?: number;
  walls: { widthM: number; heightM: number }[];
}

export function tileZoneAreaM2(zone: TileZone): number {
  const floor = zone.floorAreaM2 ?? 0;
  if (floor < 0) throw new CalcError("Отрицательная площадь пола", "NEGATIVE_AREA");
  const wallsArea = zone.walls.reduce((sum, w) => {
    if (w.widthM <= 0 || w.heightM <= 0) {
      throw new CalcError("Отрицательная или нулевая площадь стены", "NEGATIVE_AREA");
    }
    return sum + w.widthM * w.heightM;
  }, 0);
  return floor + wallsArea;
}

/** Shower corner: floor + N walls, own geometry - test #10: 1x1 corner, 2 walls 2.5m -> 6 m². */
export function showerCornerAreaM2(widthM: number, depthM: number, wallHeightM: number, wallCount = 2): number {
  if (widthM <= 0 || depthM <= 0 || wallHeightM <= 0) {
    throw new CalcError("Отрицательная или нулевая площадь недопустима", "NEGATIVE_AREA");
  }
  const floor = widthM * depthM;
  // both walls share the corner's footprint dimensions in the simple case
  const wallsArea = wallCount * (widthM * wallHeightM);
  return floor + wallsArea;
}

export type TileBaseMode = "PACKAGE" | "DETAILED";

export interface TileBaseDetailed {
  gvlPerM2: Money;
  waterproofingPerM2: Money;
  gluePerM2: Money;
  laborPerM2: Money;
}

/**
 * Two mutually exclusive ways to price the tile substrate (§11, test #11):
 * a comprehensive package rate, OR the detailed component breakdown - never
 * both added together. In PACKAGE mode the detailed components can still be
 * shown to production, but their cost is informational (zero).
 */
export function tileBaseCost(
  mode: TileBaseMode,
  areaM2: number,
  packagePricePerM2: Money,
  detailed?: TileBaseDetailed,
): { cost: Money; informationalComponents: Partial<TileBaseDetailed> } {
  if (areaM2 < 0) throw new CalcError("Отрицательная площадь", "NEGATIVE_AREA");
  if (mode === "PACKAGE") {
    return {
      cost: money(packagePricePerM2).times(areaM2),
      informationalComponents: detailed ?? {},
    };
  }
  if (!detailed) {
    throw new CalcError("Для подробного режима нужен состав ГВЛ/гидроизоляции/клея/работ", "MISSING_DETAILED_COMPONENTS");
  }
  const perM2 = money(detailed.gvlPerM2)
    .plus(detailed.waterproofingPerM2)
    .plus(detailed.gluePerM2)
    .plus(detailed.laborPerM2);
  return { cost: perM2.times(areaM2), informationalComponents: {} };
}

/** Standard ceiling canvas cost: base price/m² + cutting % applied ONCE to the base (§12, test #12: 420 * 1.02 = 428.40). */
export function ceilingCanvasCostPerM2(basePricePerM2: Money, cuttingFraction = 0.02): Money {
  return money(basePricePerM2).times(1 + cuttingFraction);
}

export const CEILING_RATES = {
  installPerM2: money(420),
  canvasPerM2: money(420),
  cuttingFraction: 0.02,
  baguetteWithFasteningPerM: money(180),
  insertPerM: money(65),
  floatingProfileWithInstallPerM: money(2600),
  spotInstallEach: money(550),
  chandelierInstallEach: money(400),
  curtainRodUpTo3mEach: money(1000),
};
