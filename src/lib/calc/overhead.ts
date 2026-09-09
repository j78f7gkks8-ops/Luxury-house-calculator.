import { CalcError, money, Money, sum } from "./money";

/** Overhead allocation - §17. All figures are editable, scoped policy inputs, not constants. */
export interface OverheadComponent {
  name: string;
  monthlyAmount: Money;
  /** e.g. modular-house advertising share = 0.65 - a fraction of this line item that applies to this business line. */
  applicableShare?: number;
}

export function monthlyOverhead(components: OverheadComponent[]): Money {
  return sum(
    components.map((c) => money(c.monthlyAmount).times(c.applicableShare ?? 1)),
  );
}

export function annualOverhead(monthly: Money): Money {
  return money(monthly).times(12);
}

/** Equal split across a planned comparable output. */
export function overheadPerHouseEqualSplit(annual: Money, plannedHouseCount: number): Money {
  if (plannedHouseCount <= 0) {
    throw new CalcError("Плановый выпуск должен быть положительным", "INVALID_PLAN_QTY");
  }
  return money(annual).dividedBy(plannedHouseCount);
}

/** Weighted split (e.g. by planned labor hours) - allocation must sum exactly to the distributed budget. */
export function overheadWeightedSplit(annual: Money, weights: number[]): Money[] {
  if (weights.length === 0) throw new CalcError("Пустой список весов", "EMPTY_WEIGHTS");
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight <= 0) throw new CalcError("Сумма весов должна быть положительной", "INVALID_WEIGHTS");
  const shares = weights.map((w) => money(annual).times(w).dividedBy(totalWeight));
  // Correct rounding drift on the last share so the total matches the budget exactly.
  const runningSum = shares.slice(0, -1).reduce((s, v) => s.plus(v), money(0));
  shares[shares.length - 1] = money(annual).minus(runningSum);
  return shares;
}

export function toolAmortizationPerHouse(amortization: Money): Money {
  return money(amortization);
}

export function fullOverheadPerHouse(overheadPerHouse: Money, amortizationPerHouse: Money): Money {
  return money(overheadPerHouse).plus(amortizationPerHouse);
}
