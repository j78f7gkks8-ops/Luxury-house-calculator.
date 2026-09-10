import Decimal from "decimal.js";

/**
 * Единая точность для денег и площадей. Раздел 22: "используй Decimal либо целые копейки".
 * Мы используем Decimal.js во всём ядре, чтобы не терять точность на промежуточных шагах
 * (раздел 11.7: "не рассчитывай итог через округлённую экранную цену").
 */
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type Num = Decimal.Value;

export function d(value: Num): Decimal {
  return new Decimal(value);
}

/** Округление до копеек (2 знака), только для финального представления суммы. */
export function toKopecks(value: Num): Decimal {
  return d(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Округление до целых рублей вверх — используется политикой округления цены (раздел 18/21). */
export function roundUpToStep(value: Num, step: Num): Decimal {
  const v = d(value);
  const s = d(step);
  if (s.lte(0)) return v;
  return v.dividedBy(s).ceil().times(s);
}

/** Применение процентной надбавки: value * (1 + pct/100). pct задаётся числом (10 = 10%). */
export function applyPercent(value: Num, pct: Num): Decimal {
  return d(value).times(d(1).plus(d(pct).dividedBy(100)));
}

/** Доля от суммы: value * pct/100. */
export function percentOf(value: Num, pct: Num): Decimal {
  return d(value).times(d(pct).dividedBy(100));
}

export function sum(values: Num[]): Decimal {
  return values.reduce((acc: Decimal, v) => acc.plus(d(v)), d(0));
}

export function isPositive(value: Num): boolean {
  return d(value).gt(0);
}

export { Decimal };
