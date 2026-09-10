import { Decimal, d, Num } from "./decimal.js";

/**
 * Раздел 16: человеко-часы = люди × дни × оплачиваемые часы в день. Стоимость = часы × ставка.
 * Выездная доплата = люди × выездные дни × доплата на человека в день (НЕ умножается на часы).
 */
export function humanHours(people: Num, days: Num, hoursPerDay: Num): Decimal {
  return d(people).times(days).times(hoursPerDay);
}

export function laborCost(hours: Num, ratePerHour: Num): Decimal {
  return d(hours).times(ratePerHour);
}

export function siteAllowance(people: Num, days: Num, allowancePerPersonPerDay: Num): Decimal {
  return d(people).times(days).times(allowancePerPersonPerDay);
}

export interface LaborOperation {
  label: string;
  people: number;
  days: number;
  hoursPerDay: number;
  ratePerHour: Num;
  /** Если true — операция уже входит в пакет/бригадные часы, повторно не начисляется. */
  includedInPackage?: boolean;
}

export interface LaborOperationResult extends LaborOperation {
  hours: Decimal;
  cost: Decimal;
}

export function computeLaborOperation(op: LaborOperation): LaborOperationResult {
  const hours = humanHours(op.people, op.days, op.hoursPerDay);
  const cost = op.includedInPackage ? d(0) : laborCost(hours, op.ratePerHour);
  return { ...op, hours, cost };
}

export function totalLaborHours(ops: LaborOperationResult[]): Decimal {
  return ops.reduce((acc, o) => acc.plus(o.hours), d(0));
}

export function totalLaborCost(ops: LaborOperationResult[]): Decimal {
  return ops.reduce((acc, o) => acc.plus(o.cost), d(0));
}
