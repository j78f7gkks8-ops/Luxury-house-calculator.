import { describe, expect, it } from "vitest";
import { moduleTransport, tripBudgetCost, equipmentVisitCost } from "./logistics";
import { money, toRubles, CalcError } from "./money";

describe("logistics and installation", () => {
  it("§A3: delivery is per transported module and crane time follows those modules", () => {
    const result = moduleTransport({
      transportedModuleCount: 4,
      deliveryPricePerModuleRub: money(15000),
      craneRatePerHourRub: money(4000),
      craneHoursPerModule: 2,
    });
    expect(toRubles(result.deliveryCostRub)).toBe(60000);
    expect(result.craneHours).toBe(8);
    expect(toRubles(result.craneCostRub)).toBe(32000);
  });

  it("a per-order budget is charged once per trip, not per item carried", () => {
    const budget = { name: "Доставка людей и топливо на монтаж", amountRub: money(35000) };
    expect(toRubles(tripBudgetCost(budget))).toBe(35000);
    expect(toRubles(tripBudgetCost({ ...budget, tripCount: 2 }))).toBe(70000);
  });

  it("§8: extra piles on an existing visit do not create a second equipment delivery", () => {
    const sameVisit = equipmentVisitCost({
      hours: 1.5,
      ratePerHourRub: money(4000),
      deliveryPerVisitRub: money(4000),
      isSeparateVisit: false,
    });
    expect(toRubles(sameVisit.workRub)).toBe(6000);
    expect(toRubles(sameVisit.deliveryRub)).toBe(0);

    const ownVisit = equipmentVisitCost({
      hours: 1.5,
      ratePerHourRub: money(4000),
      deliveryPerVisitRub: money(4000),
      isSeparateVisit: true,
    });
    expect(toRubles(ownVisit.deliveryRub)).toBe(4000);
  });

  it("rejects a fractional or zero module count", () => {
    expect(() =>
      moduleTransport({
        transportedModuleCount: 0,
        deliveryPricePerModuleRub: money(15000),
        craneRatePerHourRub: money(4000),
        craneHoursPerModule: 2,
      }),
    ).toThrow(CalcError);
  });
});
