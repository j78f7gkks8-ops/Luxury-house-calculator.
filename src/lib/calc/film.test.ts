import { describe, expect, it } from "vitest";
import {
  simpleReserveAreaM2,
  rollsFractional,
  rollsWholePurchase,
  detailedLayoutAreaM2,
} from "./film";

describe("film (Izospan)", () => {
  it("acceptance #9: 100 m2 with 10% total reserve = 110 m2, not 121 m2", () => {
    const reserved = simpleReserveAreaM2(100, 0.1);
    expect(reserved).toBeCloseTo(110, 6);
    expect(reserved).not.toBeCloseTo(121, 6);

    expect(rollsFractional(reserved)).toBeCloseTo(110 / 70, 6);

    const purchase = rollsWholePurchase(reserved);
    expect(purchase.rolls).toBe(2);
    expect(purchase.surplusM2).toBeCloseTo(30, 6);
  });

  it("detailed layout computes real geometric overlaps, independent of the flat 10% reserve", () => {
    const layout = detailedLayoutAreaM2(4.4, 2.5); // > roll width, needs multiple strips
    expect(layout.stripCount).toBeGreaterThan(1);
    expect(layout.materialAreaM2).toBeGreaterThan(4.4 * 2.5); // overlaps cost extra material
  });
});
