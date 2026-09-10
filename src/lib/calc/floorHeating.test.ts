import { describe, expect, it } from "vitest";
import {
  packLoopsIntoCoils,
  feedLengthM,
  validateLoopLimit,
  checkManifoldCapacity,
} from "./floorHeating";
import { CalcError } from "./money";

describe("floor heating", () => {
  it("acceptance #13: ten 60m loops require 4 x 200m coils, not ceil(600/200)=3; no single usable remnant covers it all", () => {
    const loops = new Array(10).fill(60);
    const result = packLoopsIntoCoils(loops, 200);
    expect(result.coilsUsed).toBe(4);
    expect(result.totalWasteM).toBe(200);
    // no single bin holds the whole 200m of waste as one usable remnant
    expect(Math.max(...result.bins.map((b) => b.wasteM))).toBeLessThan(200);
  });

  it("acceptance #14: TOTAL feed of 3m is not multiplied by loop count; PER_LOOP explicitly changes the result", () => {
    const total = feedLengthM({ scope: "TOTAL", loopCount: 5, totalFeedM: 3 });
    expect(total).toBe(3);

    const perLoop = feedLengthM({ scope: "PER_LOOP", loopCount: 5, perLoopFeedM: 3 });
    expect(perLoop).toBe(15);
    expect(perLoop).not.toBe(total);
  });

  it("acceptance #14: a loop exceeding the configured limit is flagged, not silently accepted", () => {
    expect(validateLoopLimit(65, 60).ok).toBe(false);
    expect(validateLoopLimit(58, 60).ok).toBe(true);
  });

  it("a loop longer than the coil throws instead of silently splicing it", () => {
    expect(() => packLoopsIntoCoils([250], 200)).toThrow(CalcError);
  });

  it("manifold capacity: 2 outlets per loop, flags insufficient manifolds (acceptance #24)", () => {
    expect(checkManifoldCapacity(20, 10).ok).toBe(true);
    expect(checkManifoldCapacity(16, 10).ok).toBe(false);
  });
});
