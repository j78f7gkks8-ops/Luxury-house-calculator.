import Decimal from "decimal.js";

/**
 * All money math goes through Decimal to avoid floating point drift.
 * Values are stored/returned as Decimal; convert to number only at the UI edge.
 */
Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export type Money = Decimal;

export function money(value: Decimal.Value): Money {
  return new Decimal(value);
}

export const ZERO = money(0);

export function sum(values: Decimal.Value[]): Money {
  return values.reduce((acc: Money, v) => acc.plus(v), money(0));
}

/** Round to a fixed number of decimal places (default 2 = kopecks). */
export function round(value: Decimal.Value, decimals = 2): Money {
  return money(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}

/** Round UP to the nearest multiple of `step` (e.g. price rounding policy). */
export function roundUpToStep(value: Decimal.Value, step: Decimal.Value): Money {
  const v = money(value);
  const s = money(step);
  if (s.lte(0)) return v;
  return v.dividedBy(s).ceil().times(s);
}

/** Round to the nearest multiple of `step`. */
export function roundToStep(value: Decimal.Value, step: Decimal.Value): Money {
  const v = money(value);
  const s = money(step);
  if (s.lte(0)) return v;
  return v.dividedBy(s).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(s);
}

/** Integer kopecks for persistence (never for intermediate math). */
export function toKopecks(value: Decimal.Value): number {
  return money(value).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function fromKopecks(kopecks: number): Money {
  return money(kopecks).dividedBy(100);
}

export function toRubles(value: Decimal.Value): number {
  return money(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export class CalcError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CalcError";
  }
}
