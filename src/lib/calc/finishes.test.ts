import { describe, expect, it } from "vitest";
import { showerCornerAreaM2, tileBaseCost, ceilingCanvasCostPerM2 } from "./finishes";
import { money, toRubles } from "./money";

describe("finishes", () => {
  it("acceptance #10: shower corner 1x1m, two 2.5m walls, floor = 6 m2, not 1 m2", () => {
    expect(showerCornerAreaM2(1, 1, 2.5, 2)).toBe(6);
  });

  it("acceptance #11: package tile base rate does not get GVL/glue/waterproofing added on top", () => {
    const result = tileBaseCost("PACKAGE", 10, money(5000), {
      gvlPerM2: money(800),
      waterproofingPerM2: money(400),
      gluePerM2: money(300),
      laborPerM2: money(600),
    });
    expect(toRubles(result.cost)).toBe(50000); // 10 * 5000, nothing added
  });

  it("acceptance #12: ceiling canvas 420 + 2% cutting = 428.40, not 420.84", () => {
    const perM2 = ceilingCanvasCostPerM2(money(420), 0.02);
    expect(toRubles(perM2)).toBeCloseTo(428.4, 2);
    expect(toRubles(perM2)).not.toBeCloseTo(420.84, 2);
  });
});
