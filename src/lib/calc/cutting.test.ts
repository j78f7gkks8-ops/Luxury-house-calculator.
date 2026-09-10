import { describe, expect, it } from "vitest";
import { planCutting } from "./cutting";
import { CalcError } from "./money";

describe("planCutting (raskroy)", () => {
  it("acceptance #1: two 2910mm pieces fit in a 6000mm bar with 3mm kerf, two 3205mm do not", () => {
    const fit = planCutting(6000, 3, [
      { id: "a", lengthMm: 2910, qty: 2, sectionKey: "150x45" },
    ]);
    expect(fit.totalStockBars).toBe(1);
    expect(fit.feasible).toBe(true);
    expect(fit.piecesPlaced).toBe(2);

    const noFit = planCutting(6000, 3, [
      { id: "b", lengthMm: 3205, qty: 2, sectionKey: "150x45" },
    ]);
    expect(noFit.totalStockBars).toBe(2);
    expect(noFit.feasible).toBe(true); // each piece individually still fits alone
    expect(noFit.bins.every((bin) => bin.pieces.length === 1)).toBe(true);
  });

  it("acceptance #2: does not lose or duplicate pieces, respects kerf, unknown length throws instead of becoming 0", () => {
    const plan = planCutting(6000, 3, [
      { id: "stud", lengthMm: 2400, qty: 5, sectionKey: "150x45" },
      { id: "rafter", lengthMm: 1800, qty: 3, sectionKey: "150x45" },
    ]);
    expect(plan.piecesRequested).toBe(8);
    expect(plan.piecesPlaced).toBe(8);
    const placedIds = plan.bins.flatMap((b) => b.pieces.map((p) => p.pieceId));
    expect(placedIds.filter((id) => id === "stud")).toHaveLength(5);
    expect(placedIds.filter((id) => id === "rafter")).toHaveLength(3);
    for (const bin of plan.bins) {
      expect(bin.usedMm).toBeLessThanOrEqual(6000);
    }

    expect(() =>
      planCutting(6000, 3, [
        { id: "unknown", lengthMm: undefined as unknown as number, qty: 1, sectionKey: "150x45" },
      ]),
    ).toThrow(CalcError);
  });

  it("a piece exactly the stock length needs no mid-cut; adding a required end trim flags a format mismatch", () => {
    const wholePiece = planCutting(6000, 3, [
      { id: "whole", lengthMm: 6000, qty: 1, sectionKey: "150x45" },
    ]);
    expect(wholePiece.feasible).toBe(true);
    expect(wholePiece.bins[0]!.wasteMm).toBe(0);

    const withTrim = planCutting(6000, 3, [
      { id: "whole-trim", lengthMm: 6000, qty: 1, sectionKey: "150x45", endTrimMm: 20 },
    ]);
    expect(withTrim.feasible).toBe(false);
    expect(withTrim.unplaceable).toContain("whole-trim");
  });

  it("does not mix different sections in one cutting run", () => {
    expect(() =>
      planCutting(6000, 3, [
        { id: "a", lengthMm: 1000, qty: 1, sectionKey: "150x45" },
        { id: "b", lengthMm: 1000, qty: 1, sectionKey: "200x50" },
      ]),
    ).toThrow(CalcError);
  });

  it("flags on-site fitting pieces instead of presenting a precise cut length", () => {
    const plan = planCutting(6000, 3, [
      { id: "fit", lengthMm: 2900, qty: 1, sectionKey: "150x45", fitOnSite: true },
    ]);
    expect(plan.warnings.some((w) => w.includes("подгонка по месту"))).toBe(true);
  });
});
