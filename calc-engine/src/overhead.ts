import { Decimal, d, Num, percentOf } from "./decimal.js";

/**
 * Раздел 17: накладные расходы. Условная аренда цеха учитывается в экономике, но НЕ создаёт
 * фиктивный денежный платёж — это ответственность денежного отчёта (раздел 17), здесь
 * считается только распределённая экономическая величина.
 */
export interface OverheadComponents {
  adsMonthly: Num;
  adsShareForModularHouses: Num; // доля, например 0.65
  officeMonthly: Num;
  workshopRentMonthly: Num; // условная аренда — не денежный платёж
  workshopElectricityMonthly: Num;
}

export function monthlyOverheadTotal(c: OverheadComponents): Decimal {
  const ads = percentOf(c.adsMonthly, d(c.adsShareForModularHouses).times(100));
  return ads.plus(c.officeMonthly).plus(c.workshopRentMonthly).plus(c.workshopElectricityMonthly);
}

export function yearlyOverheadTotal(c: OverheadComponents): Decimal {
  return monthlyOverheadTotal(c).times(12);
}

export function overheadPerHouse(yearlyTotal: Num, plannedHousesPerYear: Num): Decimal {
  if (d(plannedHousesPerYear).lte(0)) throw new Error("plannedHousesPerYear must be positive");
  return d(yearlyTotal).dividedBy(plannedHousesPerYear);
}

export function fullOverheadPerHouseWithAmortization(overheadPerHouseValue: Num, toolAmortizationPerHouse: Num): Decimal {
  return d(overheadPerHouseValue).plus(toolAmortizationPerHouse);
}

/** Раздел 17: резерв R = r × база (по умолчанию 5% от прямых затрат D — предложенная, не утверждённая ставка). */
export const DEFAULT_RESERVE_PCT = 5;

export function reserveAmount(directCostsD: Num, reservePct: Num = DEFAULT_RESERVE_PCT): Decimal {
  return percentOf(directCostsD, reservePct);
}

/** Полная экономическая себестоимость C = D + R + O + A (если A уже внутри O — не прибавлять повторно). */
export function fullEconomicCost(directCostsD: Num, reserveR: Num, allocatedOverheadO: Num, amortizationA: Num = 0): Decimal {
  return d(directCostsD).plus(reserveR).plus(allocatedOverheadO).plus(amortizationA);
}

/**
 * Распределение накладных по весам (например, плановые человеко-часы). Сумма распределений
 * должна совпадать с распределяемым бюджетом (раздел 17).
 */
export function allocateOverheadByWeights(totalBudget: Num, weights: Num[]): Decimal[] {
  const totalWeight = weights.reduce((acc: Decimal, w) => acc.plus(d(w)), d(0));
  if (totalWeight.eq(0)) throw new Error("total weight must be positive");
  return weights.map((w) => d(totalBudget).times(w).dividedBy(totalWeight));
}
