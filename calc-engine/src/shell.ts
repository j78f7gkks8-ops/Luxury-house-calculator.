import { Decimal, d, Num } from "./decimal.js";
import { roofPlaneAreaM2, roofRidgeRiseM, rectAreaM } from "./geometry.js";

/**
 * Раздел 7.4/7.5: геометрия закрытой части дома для расчёта "дома без внутренней отделки".
 * Работает только для прямоугольного закрытого контура (11 из 13 стартовых планировок —
 * см. project_catalog.json); Г-образные/составные контуры (Норма 38, Норма 54) сюда
 * не подставляются — для них geometry engine честно возвращает статус needs_size,
 * а не приблизительный прямоугольник, подменяющий реальную форму (раздел 7.4: "не объединяй
 * все контуры по одному признаку").
 */
export interface RectFootprint {
  /** Пролёт — поперечная величина, определяющая уклон/высоту конька крыши (раздел 7.2). */
  spanM: Num;
  /** Длина вдоль конька / цепочки модулей — то, что удлиняет терраса (раздел 7). */
  lengthM: Num;
}

export function footprintAreaM2(f: RectFootprint): Decimal {
  return rectAreaM(f.spanM, f.lengthM);
}

export function wallPerimeterM(f: RectFootprint): Decimal {
  return d(f.spanM).plus(f.lengthM).times(2);
}

export function grossWallAreaM2(f: RectFootprint, wallHeightM: Num): Decimal {
  return wallPerimeterM(f).times(wallHeightM);
}

export interface BarnRoofResult {
  ridgeRiseM: Decimal;
  perPlaneAreaM2: Decimal;
  totalAreaM2: Decimal;
}

/**
 * Раздел 7.2: два ската, каждый — горизонтальная проекция (половина пролёта + свес) / cos(угла).
 * Свес — редактируемый параметр профиля, не одна и та же назначенная владельцем константа
 * для каждого случая (раздел 7.2 предупреждает именно об этом).
 */
export function barnGableRoofAreaM2(f: RectFootprint, angleDeg: Num, overhangM: Num = 0.3): BarnRoofResult {
  const perPlaneProjection = d(f.lengthM).times(d(f.spanM).dividedBy(2).plus(overhangM));
  const perPlaneArea = roofPlaneAreaM2(perPlaneProjection, angleDeg);
  return {
    ridgeRiseM: roofRidgeRiseM(f.spanM, angleDeg),
    perPlaneAreaM2: perPlaneArea,
    totalAreaM2: perPlaneArea.times(2),
  };
}

/** Раздел 7.3: у Нормы отдельный (обычно малый) уклон — та же формула, другой угол. */
export function lowSlopeRoofAreaM2(f: RectFootprint, angleDeg: Num, overhangM: Num = 0.3): Decimal {
  const projection = footprintAreaM2(f).plus(wallPerimeterM(f).times(overhangM));
  return roofPlaneAreaM2(projection, angleDeg);
}

/**
 * Раздел 11.5.1: "A_непрозрачной_части_стены = A_контура_стены − A_объединения_проёмов".
 * Проёмы не могут превышать площадь стен — это ошибка геометрии, а не отрицательная стена.
 */
export function netWallAreaM2(grossWallAreaM2Value: Num, openingsAreaM2: Num): Decimal {
  const net = d(grossWallAreaM2Value).minus(openingsAreaM2);
  if (net.lt(0)) {
    throw new Error("Суммарная площадь проёмов превышает площадь стен — проверьте геометрию проёмов");
  }
  return net;
}

export function insulationVolumeM3(areaM2: Num, thicknessMm: Num): Decimal {
  return d(areaM2).times(thicknessMm).dividedBy(1000);
}
