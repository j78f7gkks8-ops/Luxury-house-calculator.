import { describe, it, expect } from "vitest";
import { cutParts, sheetLowerBoundCount } from "../src/cutting.js";

describe("раздел 23 п.1-2: раскрой пиломатериала", () => {
  it("две детали по 2910 мм помещаются в 6000 мм при пропиле 3 мм (одна заготовка)", () => {
    const result = cutParts([{ id: "a", lengthMm: 2910, qty: 2 }], { stockLengthMm: 6000, kerfMm: 3 });
    expect(result.totalStockUsed).toBe(1);
    expect(result.unresolvedParts).toHaveLength(0);
    expect(result.stockPieces[0].partsPlaced).toHaveLength(2);
  });

  it("две детали по 3205 мм НЕ помещаются в одну заготовку 6000 мм — требуются две", () => {
    const result = cutParts([{ id: "b", lengthMm: 3205, qty: 2 }], { stockLengthMm: 6000, kerfMm: 3 });
    expect(result.totalStockUsed).toBe(2);
    expect(result.stockPieces.every((s) => s.partsPlaced.length === 1)).toBe(true);
  });

  it("раскрой не теряет и не дублирует детали", () => {
    const result = cutParts(
      [
        { id: "x", lengthMm: 2910, qty: 5 },
        { id: "y", lengthMm: 1800, qty: 3 },
      ],
      { stockLengthMm: 6000, kerfMm: 3 }
    );
    const placedCount = result.stockPieces.reduce((n, s) => n + s.partsPlaced.length, 0);
    expect(placedCount).toBe(8);
  });

  it("неизвестная длина не превращается в ноль", () => {
    const result = cutParts([{ id: "unknown", lengthMm: null, qty: 2 }], { stockLengthMm: 6000, kerfMm: 3 });
    expect(result.unresolvedParts).toEqual([{ id: "unknown", reason: "length_unknown" }]);
    expect(result.totalStockUsed).toBe(0);
  });

  it("целая деталь 6000 мм с положительной торцовкой вызывает несовпадение формата", () => {
    const result = cutParts([{ id: "full", lengthMm: 6000, qty: 1 }], { stockLengthMm: 6000, kerfMm: 3, endTrimMm: 5 });
    expect(result.unresolvedParts).toEqual([{ id: "full", reason: "does_not_fit_stock" }]);
  });

  it("целая деталь 6000 мм без торцовки помещается без пропила", () => {
    const result = cutParts([{ id: "full", lengthMm: 6000, qty: 1 }], { stockLengthMm: 6000, kerfMm: 3 });
    expect(result.totalStockUsed).toBe(1);
    expect(result.stockPieces[0].wasteMm.toNumber()).toBe(0);
  });
});

describe("нижняя граница листового раскроя", () => {
  it("площадь/площадь листа округляется вверх, помечена как нижняя оценка", () => {
    expect(sheetLowerBoundCount(90.36, 5.796)).toBe(16);
  });
});
