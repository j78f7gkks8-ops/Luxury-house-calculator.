import { describe, it, expect } from "vitest";
import { roofRidgeRiseM, lShapeAreaFromTwoRects } from "../src/geometry.js";
import { scaleByAnalog } from "../src/analog-scaling.js";

describe("раздел 7.2: крыша Барна 9°", () => {
  it("пролёт 8 м, 9° → подъём конька ≈ 0.6335 м, а не 0.930 м (проверка отметок Барна 96)", () => {
    const rise = roofRidgeRiseM(8, 9);
    expect(rise.toFixed(4)).toBe("0.6335");
    expect(rise.toFixed(4)).not.toBe("0.9300");
  });
});

describe("раздел 23 п.3: Г-образная терраса — общая площадь считается один раз", () => {
  it("10.5×3 + 2×6 = 8.5×3 + 2×9 = 43.5 м²", () => {
    const a = lShapeAreaFromTwoRects({ widthM: 10.5, heightM: 3 }, { widthM: 2, heightM: 6 });
    const b = lShapeAreaFromTwoRects({ widthM: 8.5, heightM: 3 }, { widthM: 2, heightM: 9 });
    expect(a.toNumber()).toBe(43.5);
    expect(b.toNumber()).toBe(43.5);
  });
});

describe("раздел 16.2: масштабирование по аналогу", () => {
  it("H = H_аналога × новый/аналог × коэффициент, статус всегда preliminary_by_analog", () => {
    const result = scaleByAnalog({
      analogLabel: "Барн 96 отделка",
      analogValue: 680, // человеко-часы аналога (доделки/отделка)
      analogDriverVolume: 61.23, // м² аналога
      newDriverVolume: 71.61, // м² нового дома (Норма 107)
      complexityCoefficient: 1,
    });
    expect(result.status).toBe("preliminary_by_analog");
    expect(result.scaledValue.toFixed(2)).toBe("795.28");
  });
});
