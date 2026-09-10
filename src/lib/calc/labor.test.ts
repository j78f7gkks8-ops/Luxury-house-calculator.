import { describe, expect, it } from "vitest";
import { laborHours, laborCost, travelSurcharge, summarizeBrigadeStages, packageLaborStatus } from "./labor";
import { money, toRubles } from "./money";

describe("labor", () => {
  it("acceptance #18: 4 people x 7 days x 10h = 280h; at 550/h = 154000; travel surcharge 4x7x1000=28000", () => {
    const hours = laborHours(4, 7, 10);
    expect(hours).toBe(280);
    expect(toRubles(laborCost(hours, money(550)))).toBe(154000);
    expect(toRubles(travelSurcharge(4, 7, money(1000)))).toBe(28000);
  });

  it("acceptance #19: historical Barn brigade totals 1560h / 39 days / 858000 RUB; dobor bending is separate 15h/8250", () => {
    const summary = summarizeBrigadeStages([
      { name: "frame", people: 4, days: 7, hoursPerDay: 10 },
      { name: "facade-terrace", people: 4, days: 8, hoursPerDay: 10 },
      { name: "interior", people: 4, days: 17, hoursPerDay: 10 },
      { name: "finishing", people: 4, days: 7, hoursPerDay: 10 },
    ]);
    expect(summary.totalHours).toBe(1560);
    expect(summary.totalBrigadeDays).toBe(39);
    expect(toRubles(laborCost(summary.totalHours, money(550)))).toBe(858000);

    const doborHours = laborHours(1, 1.5, 10);
    expect(doborHours).toBe(15);
    expect(toRubles(laborCost(doborHours, money(550)))).toBe(8250);
  });

  it("a priced package with unknown hours keeps an honest status instead of a derived guess", () => {
    expect(packageLaborStatus(null).status).toBe("HOURS_NOT_SPECIFIED");
    expect(packageLaborStatus(120).status).toBe("KNOWN");
  });
});
