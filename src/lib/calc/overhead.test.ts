import { describe, expect, it } from "vitest";
import { monthlyOverhead, annualOverhead, overheadPerHouseEqualSplit, overheadWeightedSplit, fullOverheadPerHouse } from "./overhead";
import { money, sum, toRubles } from "./money";

describe("overhead", () => {
  it("acceptance #20: (200000*0.65 + 40000 + 350000 + 40000) * 12 / 20 = 336000; + amortization 70000 = 406000", () => {
    const monthly = monthlyOverhead([
      { name: "ads", monthlyAmount: money(200000), applicableShare: 0.65 },
      { name: "office", monthlyAmount: money(40000) },
      { name: "workshop-rent", monthlyAmount: money(350000) },
      { name: "electricity", monthlyAmount: money(40000) },
    ]);
    expect(toRubles(monthly)).toBe(560000);

    const annual = annualOverhead(monthly);
    expect(toRubles(annual)).toBe(6720000);

    const perHouse = overheadPerHouseEqualSplit(annual, 20);
    expect(toRubles(perHouse)).toBe(336000);

    const withAmortization = fullOverheadPerHouse(perHouse, money(70000));
    expect(toRubles(withAmortization)).toBe(406000);
  });

  it("weighted split sums exactly to the distributed budget despite rounding", () => {
    const annual = money(1000000);
    const shares = overheadWeightedSplit(annual, [1, 1, 1]);
    const total = sum(shares);
    expect(toRubles(total)).toBe(1000000);
  });
});
