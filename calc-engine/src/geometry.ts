import { Decimal, d, Num } from "./decimal.js";

/**
 * Раздел 7.2: Барн, двускатная кровля 9° (правило владельца). Формулы применимы к простой
 * симметричной крыше с одинаковыми отметками опор; для прерванного контура/разных свесов
 * нужны отдельные плоскости (не реализовано здесь — требует полной геометрии проекта).
 */
export const BARN_ROOF_ANGLE_DEG = 9;

function degToRad(deg: Num): Decimal {
  return d(deg).times(Decimal.acos(-1)).dividedBy(180);
}

export function roofRidgeRiseM(spanM: Num, angleDeg: Num = BARN_ROOF_ANGLE_DEG): Decimal {
  const halfSpan = d(spanM).dividedBy(2);
  return halfSpan.times(Decimal.tan(degToRad(angleDeg)));
}

/** Длина по скату = горизонтальная проекция со свесом / cos(угла). */
export function roofSlopeLengthM(horizontalProjectionWithOverhangM: Num, angleDeg: Num = BARN_ROOF_ANGLE_DEG): Decimal {
  return d(horizontalProjectionWithOverhangM).dividedBy(Decimal.cos(degToRad(angleDeg)));
}

/** Площадь ската = его горизонтальная проекция / cos(угла) — считается отдельно на каждую плоскость. */
export function roofPlaneAreaM2(horizontalProjectionAreaM2: Num, angleDeg: Num = BARN_ROOF_ANGLE_DEG): Decimal {
  return d(horizontalProjectionAreaM2).dividedBy(Decimal.cos(degToRad(angleDeg)));
}

/**
 * Раздел 23 п.3: общие поверхности Г-образного контура учитываются один раз. Обе допустимые
 * декомпозиции прямоугольниками должны давать одинаковую площадь, если пересечение не
 * посчитано дважды: 10.5×3 + 2×6 = 8.5×3 + 2×9 = 43.5 м².
 */
export function rectAreaM(widthM: Num, heightM: Num): Decimal {
  return d(widthM).times(heightM);
}

export function lShapeAreaFromTwoRects(rectA: { widthM: Num; heightM: Num }, rectB: { widthM: Num; heightM: Num }): Decimal {
  return rectAreaM(rectA.widthM, rectA.heightM).plus(rectAreaM(rectB.widthM, rectB.heightM));
}
