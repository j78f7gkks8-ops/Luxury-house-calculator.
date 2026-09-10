import { describe, it, expect } from "vitest";
import {
  STANDARD_WINDOW_CATALOG,
  STANDARD_CATALOG_QUANTITY,
  invoiceTotalByFinish,
  finishCoefficients,
  estimateResizedWindowPrice,
  exactCatalogPrice,
  BARN108_ORIGINAL_INVOICE,
  BARN108_DOOR_BLOCK,
  BARN108_WINDOW_BLOCK,
  barn108BlockTotal,
  addRoundedTotals,
  barn108TotalAreaM2,
} from "../src/windows.js";

const W3 = STANDARD_WINDOW_CATALOG.find((p) => p.id === "W3")!;
const W2 = STANDARD_WINDOW_CATALOG.find((p) => p.id === "W2")!;

describe("раздел 11.2: контрольные итоги трёх исполнений", () => {
  it("7 окон + входная дверь после скидки: 145662.51 / 171838.61 / 221632.59", () => {
    expect(invoiceTotalByFinish(STANDARD_WINDOW_CATALOG, STANDARD_CATALOG_QUANTITY, "white").toFixed(2)).toBe(
      "145662.51"
    );
    expect(invoiceTotalByFinish(STANDARD_WINDOW_CATALOG, STANDARD_CATALOG_QUANTITY, "outside").toFixed(2)).toBe(
      "171838.61"
    );
    expect(invoiceTotalByFinish(STANDARD_WINDOW_CATALOG, STANDARD_CATALOG_QUANTITY, "both").toFixed(2)).toBe(
      "221632.59"
    );
  });

  it("только 7 окон, без двери: 111557.92 / 136258.60 / 180777.10", () => {
    const onlyWindows = { ...STANDARD_CATALOG_QUANTITY, D1: 0 };
    expect(invoiceTotalByFinish(STANDARD_WINDOW_CATALOG, onlyWindows, "white").toFixed(2)).toBe("111557.92");
    expect(invoiceTotalByFinish(STANDARD_WINDOW_CATALOG, onlyWindows, "outside").toFixed(2)).toBe("136258.60");
    expect(invoiceTotalByFinish(STANDARD_WINDOW_CATALOG, onlyWindows, "both").toFixed(2)).toBe("180777.10");
  });
});

describe("раздел 11.2.3: коэффициенты исполнения по типу", () => {
  it("W1..D1 коэффициенты совпадают с документом (округление до 6 знаков)", () => {
    const expected: Record<string, { outside: string; both: string }> = {
      W1: { outside: "1.212480", both: "1.609678" },
      W2: { outside: "1.227925", both: "1.636643" },
      W3: { outside: "1.179101", both: "1.500852" },
      W4: { outside: "1.244109", both: "1.670018" },
      D1: { outside: "1.043262", both: "1.197947" },
    };
    for (const p of STANDARD_WINDOW_CATALOG) {
      const c = finishCoefficients(p.beforeDiscount);
      expect(c.outside.toFixed(6)).toBe(expected[p.id].outside);
      expect(c.both.toFixed(6)).toBe(expected[p.id].both);
    }
  });

  it("переход с односторонней на двустороннюю W2 даёт точную цену 26984.06, а не белое×коэффициент", () => {
    const result = estimateResizedWindowPrice({
      referenceProduct: W2,
      referenceFinish: "outside",
      targetFinish: "both",
      newWidthMm: W2.widthMm,
      newHeightMm: W2.heightMm,
    });
    expect(result.price.toFixed(2)).toBe("26984.06");
  });
});

describe("раздел 11.3.3: увеличение глухого W3 1200×2200 → 2400×2200", () => {
  it("коэффициент размера = 2", () => {
    const result = estimateResizedWindowPrice({
      referenceProduct: W3,
      referenceFinish: "white",
      targetFinish: "white",
      newWidthMm: 2400,
      newHeightMm: 2200,
    });
    expect(result.sizeCoefficient.toFixed(0)).toBe("2");
    expect(result.price.toFixed(2)).toBe("25397.05");
  });

  it("кашировка снаружи увеличенного окна: 29945.68", () => {
    const result = estimateResizedWindowPrice({
      referenceProduct: W3,
      referenceFinish: "white",
      targetFinish: "outside",
      newWidthMm: 2400,
      newHeightMm: 2200,
    });
    expect(result.price.toFixed(2)).toBe("29945.68");
  });

  it("кашировка с двух сторон увеличенного окна: 38117.21", () => {
    const result = estimateResizedWindowPrice({
      referenceProduct: W3,
      referenceFinish: "white",
      targetFinish: "both",
      newWidthMm: 2400,
      newHeightMm: 2200,
    });
    expect(result.price.toFixed(2)).toBe("38117.21");
  });
});

describe("раздел 11.3.1: точная цена из каталога приоритетнее оценки", () => {
  it("W3 без изменения размера — точная цена 12698.53 (белое)", () => {
    expect(exactCatalogPrice(W3, "white").toFixed(2)).toBe("12698.53");
  });
});

describe("раздел 11.4: панорамное остекление Барн 108", () => {
  it("исходное предложение (8 изделий, два блока) = 118531.03 ₽, площадь 13.3101 м²", () => {
    const total = barn108BlockTotal(BARN108_ORIGINAL_INVOICE);
    expect(total.toFixed(2)).toBe("118531.03");
    expect(barn108TotalAreaM2().toFixed(4)).toBe("13.3101");
  });

  it("блок с входной дверью = 67095.21 ₽; блок с окном = 51435.82 ₽", () => {
    expect(barn108BlockTotal(BARN108_DOOR_BLOCK).toFixed(2)).toBe("67095.21");
    expect(barn108BlockTotal(BARN108_WINDOW_BLOCK).toFixed(2)).toBe("51435.82");
  });

  it("задний блок с дверью: три блока 185626.24 ₽; с окном: 169966.85 ₽", () => {
    const original = barn108BlockTotal(BARN108_ORIGINAL_INVOICE);
    const doorBlock = barn108BlockTotal(BARN108_DOOR_BLOCK);
    const windowBlock = barn108BlockTotal(BARN108_WINDOW_BLOCK);
    expect(addRoundedTotals(original, doorBlock).toFixed(2)).toBe("185626.24");
    expect(addRoundedTotals(original, windowBlock).toFixed(2)).toBe("169966.85");
  });
});
