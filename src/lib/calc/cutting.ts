import { CalcError } from "./money";

/**
 * One-dimensional cutting stock (raskroy) for framing timber / battens.
 *
 * This is a reproducible heuristic (first-fit-decreasing bin packing), not a
 * proven optimum - see §9: "Не называй раскрой оптимальным без доказательства.
 * Показывай нижнюю оценку, найденный допустимый раскрой, отходы и ограничения."
 */

export interface CutPieceSpec {
  /** Stable id of the physical detail (not the batch). */
  id: string;
  lengthMm: number;
  qty: number;
  /** Grouping key: different sections/grades must not share a stock bar. */
  sectionKey: string;
  /**
   * One-time end trim (торцовка) this specific piece needs in addition to
   * its saw kerfs, e.g. to square a factory end. A piece that is exactly the
   * stock length AND requires an end trim cannot be cut from a single bar -
   * that is flagged, not silently ignored.
   */
  endTrimMm?: number;
  /** Piece explicitly marked as requiring on-site fitting: length is preliminary. */
  fitOnSite?: boolean;
}

export interface CutBin {
  stockIndex: number;
  pieces: { pieceId: string; lengthMm: number }[];
  usedMm: number;
  wasteMm: number;
}

export interface CutPlanResult {
  sectionKey: string;
  stockLengthMm: number;
  kerfMm: number;
  bins: CutBin[];
  totalStockBars: number;
  totalWasteMm: number;
  /** ceil(total required length / stock length) - a lower bound, not a guarantee it is achievable. */
  lowerBoundBars: number;
  /** true only if every requested piece was successfully placed. */
  feasible: boolean;
  /** piece ids that could not be placed in any single stock bar at all. */
  unplaceable: string[];
  piecesPlaced: number;
  piecesRequested: number;
  warnings: string[];
}

interface Instance {
  pieceId: string;
  lengthMm: number;
  requiredMm: number; // length + kerf + own end trim
}

export function planCutting(
  stockLengthMm: number,
  kerfMm: number,
  pieces: CutPieceSpec[],
): CutPlanResult {
  if (!Number.isFinite(stockLengthMm) || stockLengthMm <= 0) {
    throw new CalcError("Некорректная длина заготовки", "INVALID_STOCK_LENGTH");
  }
  if (!Number.isFinite(kerfMm) || kerfMm < 0) {
    throw new CalcError("Некорректный пропил", "INVALID_KERF");
  }
  if (pieces.length === 0) {
    throw new CalcError("Пустой список деталей для раскроя", "EMPTY_PIECE_LIST");
  }

  const sectionKeys = new Set(pieces.map((p) => p.sectionKey));
  if (sectionKeys.size > 1) {
    throw new CalcError(
      "Нельзя смешивать разные сечения/сорта в одном раскрое",
      "MIXED_SECTIONS",
      { sectionKeys: Array.from(sectionKeys) },
    );
  }
  const sectionKey = pieces[0]!.sectionKey;

  const instances: Instance[] = [];
  const warnings: string[] = [];
  const unplaceable: string[] = [];
  const piecesRequested = pieces.reduce((s, p) => s + (p.qty > 0 ? p.qty : 0), 0);

  for (const p of pieces) {
    if (p.lengthMm === undefined || p.lengthMm === null || !Number.isFinite(p.lengthMm)) {
      throw new CalcError(
        `У детали "${p.id}" не задана длина - неизвестная длина не может считаться нулём`,
        "UNKNOWN_LENGTH",
        { pieceId: p.id },
      );
    }
    if (p.lengthMm <= 0) {
      throw new CalcError(`У детали "${p.id}" некорректная длина`, "INVALID_LENGTH", {
        pieceId: p.id,
      });
    }
    if (!Number.isInteger(p.qty) || p.qty <= 0) {
      throw new CalcError(`У детали "${p.id}" некорректное количество`, "INVALID_QTY", {
        pieceId: p.id,
      });
    }
    if (p.fitOnSite) {
      warnings.push(
        `Деталь "${p.id}": длина предварительная, требуется подгонка по месту - не выдавать за точный размер распила.`,
      );
    }

    const endTrim = p.endTrimMm ?? 0;
    // A piece that exactly equals the full stock length needs no separating
    // kerf - the whole bar becomes the piece, nothing is being cut away from it.
    const requiredMm =
      p.lengthMm === stockLengthMm && endTrim === 0 ? p.lengthMm : p.lengthMm + kerfMm + endTrim;

    if (p.lengthMm + endTrim > stockLengthMm) {
      unplaceable.push(p.id);
      warnings.push(
        endTrim > 0 && p.lengthMm === stockLengthMm
          ? `Деталь "${p.id}": заготовка ровно ${stockLengthMm} мм, но нужна ещё торцовка ${endTrim} мм - несовпадение формата.`
          : `Деталь "${p.id}": длина ${p.lengthMm} мм не помещается в заготовку ${stockLengthMm} мм ни при каком раскрое.`,
      );
      continue;
    }

    for (let i = 0; i < p.qty; i++) {
      instances.push({ pieceId: p.id, lengthMm: p.lengthMm, requiredMm });
    }
  }

  // First-fit-decreasing: sort by required length, longest first.
  const sorted = [...instances].sort((a, b) => b.requiredMm - a.requiredMm);

  const bins: CutBin[] = [];
  for (const inst of sorted) {
    let placed = false;
    for (const bin of bins) {
      if (bin.usedMm + inst.requiredMm <= stockLengthMm) {
        bin.pieces.push({ pieceId: inst.pieceId, lengthMm: inst.lengthMm });
        bin.usedMm += inst.requiredMm;
        placed = true;
        break;
      }
    }
    if (!placed) {
      bins.push({
        stockIndex: bins.length,
        pieces: [{ pieceId: inst.pieceId, lengthMm: inst.lengthMm }],
        usedMm: inst.requiredMm,
        wasteMm: 0,
      });
    }
  }
  for (const bin of bins) {
    bin.wasteMm = stockLengthMm - bin.usedMm;
  }

  const totalRequiredMm = instances.reduce((s, i) => s + i.requiredMm, 0);
  const lowerBoundBars = Math.ceil(totalRequiredMm / stockLengthMm);
  const totalWasteMm = bins.reduce((s, b) => s + b.wasteMm, 0);
  const piecesPlaced = bins.reduce((s, b) => s + b.pieces.length, 0);

  if (unplaceable.length > 0) {
    warnings.push(
      "Раскрой неполный: часть деталей не помещается в выбранную заготовку и требует другой длины стока.",
    );
  }

  return {
    sectionKey,
    stockLengthMm,
    kerfMm,
    bins,
    totalStockBars: bins.length,
    totalWasteMm,
    lowerBoundBars,
    feasible: unplaceable.length === 0,
    unplaceable,
    piecesPlaced,
    piecesRequested,
    warnings,
  };
}
