import { describe, expect, it } from "vitest";
import { buildBarn96KyzylSnapshot } from "./barn96Kyzyl";

describe("Barn 96 / Kyzyl template - end to end through the real engine", () => {
  it("reproduces the historical §Б1 / acceptance #22 numbers exactly with no options selected", () => {
    const snapshot = buildBarn96KyzylSnapshot({ terraceDepthM: 2, selectedOptionIds: [] });

    expect(snapshot.costSummary.directCostsRub).toBeCloseTo(4883473.03, 2);
    expect(snapshot.costSummary.reserveRub).toBeCloseTo(244173.65, 2);
    expect(snapshot.costSummary.overheadRub).toBeCloseTo(406000, 2);
    expect(snapshot.costSummary.fullCostRub).toBeCloseTo(5533646.68, 2);

    expect(snapshot.priceSummary.roundedPriceRub).toBeCloseTo(8300000, 0);
    expect(snapshot.priceSummary.taxRub).toBeCloseTo(498000, 2);
    expect(snapshot.priceSummary.commissionRub).toBeCloseTo(166000, 2);
    expect(snapshot.priceSummary.profitRub).toBeCloseTo(2102353.32, 2);
  });

  it("acceptance #5: enlarging the terrace to 3m keeps 25 piles", () => {
    const snapshot = buildBarn96KyzylSnapshot({ terraceDepthM: 3, selectedOptionIds: [] });
    expect(snapshot.pileSummary.totalPiles).toBe(25);
  });

  it("options add real, engine-computed lines - not hardcoded totals", () => {
    const withoutOptions = buildBarn96KyzylSnapshot({ terraceDepthM: 2, selectedOptionIds: [] });
    const withWarmFloor = buildBarn96KyzylSnapshot({ terraceDepthM: 2, selectedOptionIds: ["warm-floor"] });
    expect(withWarmFloor.costSummary.directCostsRub).toBeGreaterThan(withoutOptions.costSummary.directCostsRub);
    expect(withWarmFloor.compositionLines.some((l) => l.key === "interior:floor:warm-coils")).toBe(true);
  });

  it("acceptance #23: disabling all options still protects the base configuration's minimum profit", () => {
    const snapshot = buildBarn96KyzylSnapshot({
      terraceDepthM: 2,
      selectedOptionIds: [],
      minimumBaseProfitRub: 500000,
    });
    expect(snapshot.priceSummary.baseProfitProtected).toBe(true);
  });

  it("unpriced required lines (pile cost, boiler-room kit) stay visible as gaps, never silently zero", () => {
    const snapshot = buildBarn96KyzylSnapshot({ terraceDepthM: 2, selectedOptionIds: ["boiler-room"] });
    expect(snapshot.costSummary.linesWithMissingPrice).toContain("foundation:piles:main");
    expect(snapshot.costSummary.linesWithMissingPrice).toContain("options:boiler-room:kit");
  });
});
