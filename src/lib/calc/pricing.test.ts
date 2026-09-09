import { describe, expect, it } from "vitest";
import {
  priceByTargetProfit,
  evaluatePrice,
  applyRoundingPolicy,
  checkBaseProfitProtected,
  priceByMarkup,
  priceByTargetProfitShare,
} from "./pricing";
import { money, toRubles } from "./money";
import { CalcError } from "./money";

const rates = { taxFraction: 0.06, commissionFraction: 0.02 };

describe("pricing", () => {
  it("acceptance #21: C=5,200,000 G=2,000,000 t=6% m=2% -> raw price 7,826,086.96..., rounded up to 50000 = 7,850,000, profit 2,022,000", () => {
    const raw = priceByTargetProfit(money(5200000), money(2000000), rates);
    expect(toRubles(raw)).toBeCloseTo(7826086.9565, 2);

    const { roundedTotal } = applyRoundingPolicy(raw, { totalStep: money(50000) });
    expect(toRubles(roundedTotal)).toBe(7850000);

    const evaluation = evaluatePrice(roundedTotal, money(5200000), rates);
    expect(toRubles(evaluation.profit)).toBe(2022000);
  });

  it("acceptance #22: historical check C=5,533,646.68 P=8,300,000 -> tax 498000, commission 166000, profit 2,102,353.32", () => {
    const evaluation = evaluatePrice(money(8300000), money(5533646.68), rates);
    expect(toRubles(evaluation.tax)).toBe(498000);
    expect(toRubles(evaluation.commission)).toBe(166000);
    expect(toRubles(evaluation.profit)).toBeCloseTo(2102353.32, 2);
  });

  it("acceptance #23: disabling all add-ons still leaves the base configuration meeting its own minimum profit", () => {
    const protectedCheck = checkBaseProfitProtected(money(4200000), money(3200000), money(500000), rates);
    expect(protectedCheck.ok).toBe(true);

    const failingCheck = checkBaseProfitProtected(money(3300000), money(3200000), money(500000), rates);
    expect(failingCheck.ok).toBe(false);
    expect(toRubles(failingCheck.shortfall)).toBeGreaterThan(0);
  });

  it("acceptance #24: guards against invalid denominators, zero/negative cost", () => {
    expect(() => priceByTargetProfit(money(1000), money(100), { taxFraction: 0.5, commissionFraction: 0.5 })).toThrow(
      CalcError,
    );
    expect(() => priceByTargetProfitShare(money(1000), 0.99, { taxFraction: 0.06, commissionFraction: 0.02 })).toThrow(
      CalcError,
    );
    expect(() => priceByMarkup(money(0), 0.1)).toThrow(CalcError);
    expect(() => priceByMarkup(money(-100), 0.1)).toThrow(CalcError);
  });

  it("markup and margin are not interchangeable metrics", () => {
    const evaluation = evaluatePrice(money(150), money(100), { taxFraction: 0, commissionFraction: 0 });
    expect(evaluation.markup).toBeCloseTo(0.5, 6); // 150/100 - 1
    expect(evaluation.marginAfterTaxCommission).toBeCloseTo(1 / 3, 6); // 50/150
    expect(evaluation.markup).not.toBeCloseTo(evaluation.marginAfterTaxCommission, 2);
  });
});
