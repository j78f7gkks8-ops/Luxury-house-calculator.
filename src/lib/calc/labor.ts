import { CalcError, money, Money } from "./money";

/** Labor accounting - §16. Человеко-час is the base unit. */
export function laborHours(people: number, days: number, hoursPerDay: number): number {
  if (people <= 0 || days <= 0 || hoursPerDay <= 0) {
    throw new CalcError("Люди/дни/часы должны быть положительными", "INVALID_LABOR_INPUT");
  }
  return people * days * hoursPerDay;
}

export function laborCost(hours: number, ratePerHour: Money): Money {
  if (hours < 0) throw new CalcError("Отрицательные часы недопустимы", "NEGATIVE_HOURS");
  return money(ratePerHour).times(hours);
}

/** Travel surcharge is per person per travel-day, NOT multiplied by hours again. */
export function travelSurcharge(people: number, travelDays: number, perPersonPerDay: Money): Money {
  if (people <= 0 || travelDays <= 0) {
    throw new CalcError("Люди/выездные дни должны быть положительными", "INVALID_TRAVEL_INPUT");
  }
  return money(perPersonPerDay).times(people).times(travelDays);
}

export interface WorkStage {
  name: string;
  people: number;
  days: number;
  hoursPerDay: number;
}

export interface StageLaborResult extends WorkStage {
  hours: number;
}

/**
 * Sums one brigade's sequential stages, mirrors the historical Barn
 * calibration example (§16): 39 "бригадных дней" is the sum of calendar
 * days across stages for the SAME brigade working sequentially, not
 * people x days.
 */
export function summarizeBrigadeStages(stages: WorkStage[]): {
  stages: StageLaborResult[];
  totalHours: number;
  totalBrigadeDays: number;
} {
  const results = stages.map((s) => ({
    ...s,
    hours: laborHours(s.people, s.days, s.hoursPerDay),
  }));
  return {
    stages: results,
    totalHours: results.reduce((sum, s) => sum + s.hours, 0),
    totalBrigadeDays: results.reduce((sum, s) => sum + s.days, 0),
  };
}

/**
 * A priced package with unknown internal hours must keep status
 * "трудоёмкость не задана" rather than have hours invented by dividing
 * price by a rate (§16).
 */
export interface LaborStatus {
  status: "KNOWN" | "HOURS_NOT_SPECIFIED";
  hours?: number;
}

export function packageLaborStatus(knownHours: number | null): LaborStatus {
  return knownHours === null ? { status: "HOURS_NOT_SPECIFIED" } : { status: "KNOWN", hours: knownHours };
}
