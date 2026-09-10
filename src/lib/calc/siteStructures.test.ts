import { describe, expect, it } from "vitest";
import { skirtAreaM2, stairFlight, porch } from "./siteStructures";
import { CalcError } from "./money";

describe("site structures", () => {
  it("§15: skirt area follows the outer contour, not the internal room perimeter", () => {
    // Барн 96: outer body 9 x 8 m -> perimeter 34 m, skirt 1 m high
    const outerPerimeter = 2 * (9 + 8);
    expect(skirtAreaM2(outerPerimeter, 1)).toBe(34);

    // the sum of room perimeters is a different (larger) number and must not be used
    const roomPerimetersSum = 46;
    expect(skirtAreaM2(outerPerimeter, 1)).not.toBe(skirtAreaM2(roomPerimetersSum, 1));
  });

  it("§15: skirt height 1 m is an example, not a constant", () => {
    expect(skirtAreaM2(34, 0.6)).toBeCloseTo(20.4, 6);
  });

  it("§15: riser count is a whole number and the actual riser is derived from the real height", () => {
    // terrace descent: 1.2 m high, wish is a ~0.19-0.20 m riser
    const flight = stairFlight({ totalHeightM: 1.2, widthM: 2, preferredRiserM: 0.2, treadDepthM: 0.3 });
    expect(flight.riserCount).toBe(6);
    expect(flight.actualRiserM).toBeCloseTo(0.2, 6);

    // a height that does not divide evenly still gets whole risers and a derived height
    const awkward = stairFlight({ totalHeightM: 1.15, widthM: 2, preferredRiserM: 0.2, treadDepthM: 0.3 });
    expect(Number.isInteger(awkward.riserCount)).toBe(true);
    expect(awkward.actualRiserM * awkward.riserCount).toBeCloseTo(1.15, 6);
    expect(awkward.actualRiserM).not.toBe(0.2);
  });

  it("§15: the landing is not counted again as a tread", () => {
    const result = porch({
      landingWidthM: 1.2,
      landingDepthM: 1.2,
      stair: { totalHeightM: 1.2, widthM: 1.2, preferredRiserM: 0.2, treadDepthM: 0.3 },
    });
    expect(result.landingAreaM2).toBeCloseTo(1.44, 6);
    // 6 risers -> 5 treads between them; the 6th surface IS the landing
    expect(result.stair.riserCount).toBe(6);
    expect(result.stair.treadCount).toBe(5);
    expect(result.totalDeckedAreaM2).toBeCloseTo(1.44 + 5 * 1.2 * 0.3, 6);
  });

  it("rejects nonsense dimensions instead of producing a total", () => {
    expect(() => skirtAreaM2(0, 1)).toThrow(CalcError);
    expect(() =>
      porch({
        landingWidthM: -1,
        landingDepthM: 1.2,
        stair: { totalHeightM: 1.2, widthM: 1.2, preferredRiserM: 0.2, treadDepthM: 0.3 },
      }),
    ).toThrow(CalcError);
  });
});
