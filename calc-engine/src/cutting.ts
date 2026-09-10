import { Decimal, d } from "./decimal.js";

/**
 * Раздел 9: одномерный раскрой пиломатериала. Реализована воспроизводимая эвристика
 * (First-Fit-Decreasing с учётом пропила и торцовки), НЕ заявленная оптимальной
 * (раздел 9: "не называй раскрой оптимальным без доказательства"). Каждая деталь
 * назначается заготовке ровно один раз; неизвестная длина не превращается в ноль,
 * а попадает в unresolvedParts.
 */

export interface CutPartInput {
  id: string;
  lengthMm: number | null;
  qty: number;
}

export interface CuttingOptions {
  stockLengthMm: number;
  kerfMm: number;
  /** Торцовка на заготовку (по умолчанию 0) — расходуется один раз на заготовку. */
  endTrimMm?: number;
}

export interface PlacedPart {
  id: string;
  lengthMm: number;
}

export interface StockPieceResult {
  stockIndex: number;
  partsPlaced: PlacedPart[];
  usedLengthMm: Decimal;
  wasteMm: Decimal;
}

export interface UnresolvedPart {
  id: string;
  reason: "length_unknown" | "does_not_fit_stock";
}

export interface CuttingResult {
  stockPieces: StockPieceResult[];
  totalStockUsed: number;
  totalWasteMm: Decimal;
  unresolvedParts: UnresolvedPart[];
  isOptimal: false;
}

function stockUsedLength(partsLengths: number[], kerfMm: number, endTrimMm: number): Decimal {
  const sumLengths = partsLengths.reduce((a, l) => a + l, 0);
  const kerfTotal = partsLengths.length > 0 ? kerfMm * (partsLengths.length - 1) : 0;
  return d(sumLengths).plus(kerfTotal).plus(partsLengths.length > 0 ? endTrimMm : 0);
}

/**
 * Раскрой методом First-Fit-Decreasing: сортируем детали по убыванию длины, каждую кладём
 * в первую заготовку, куда она физически помещается с учётом уже размещённых деталей,
 * пропила между ними и торцовки; иначе открываем новую заготовку.
 */
export function cutParts(parts: CutPartInput[], options: CuttingOptions): CuttingResult {
  const { stockLengthMm, kerfMm, endTrimMm = 0 } = options;
  const unresolvedParts: UnresolvedPart[] = [];

  const items: { id: string; lengthMm: number }[] = [];
  for (const p of parts) {
    if (p.lengthMm === null || p.lengthMm === undefined) {
      unresolvedParts.push({ id: p.id, reason: "length_unknown" });
      continue;
    }
    for (let i = 0; i < p.qty; i++) items.push({ id: p.id, lengthMm: p.lengthMm });
  }

  items.sort((a, b) => b.lengthMm - a.lengthMm);

  const stocks: { lengths: number[]; ids: string[] }[] = [];

  for (const item of items) {
    let placed = false;
    for (const stock of stocks) {
      const tentative = [...stock.lengths, item.lengthMm];
      if (stockUsedLength(tentative, kerfMm, endTrimMm).lte(stockLengthMm)) {
        stock.lengths.push(item.lengthMm);
        stock.ids.push(item.id);
        placed = true;
        break;
      }
    }
    if (!placed) {
      const soloUsed = stockUsedLength([item.lengthMm], kerfMm, endTrimMm);
      if (soloUsed.gt(stockLengthMm)) {
        unresolvedParts.push({ id: item.id, reason: "does_not_fit_stock" });
        continue;
      }
      stocks.push({ lengths: [item.lengthMm], ids: [item.id] });
    }
  }

  const stockPieces: StockPieceResult[] = stocks.map((s, idx) => {
    const used = stockUsedLength(s.lengths, kerfMm, endTrimMm);
    return {
      stockIndex: idx,
      partsPlaced: s.lengths.map((lengthMm, i) => ({ id: s.ids[i], lengthMm })),
      usedLengthMm: used,
      wasteMm: d(stockLengthMm).minus(used),
    };
  });

  const totalWasteMm = stockPieces.reduce((acc, s) => acc.plus(s.wasteMm), d(0));

  return {
    stockPieces,
    totalStockUsed: stockPieces.length,
    totalWasteMm,
    unresolvedParts,
    isOptimal: false,
  };
}

/**
 * Нижняя граница для листовых материалов (ЛДСП/OSB/фанера) — раздел 9: "деление площади
 * на площадь листа — нижняя оценка, не готовая карта раскроя".
 */
export function sheetLowerBoundCount(totalAreaM2: Decimal.Value, sheetAreaM2: Decimal.Value): number {
  return d(totalAreaM2).dividedBy(sheetAreaM2).ceil().toNumber();
}
