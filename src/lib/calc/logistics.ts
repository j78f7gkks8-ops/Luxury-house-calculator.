import { CalcError, money, Money } from "./money";

/**
 * Transport, crane and installation trips - §5 blocks 5-6, §8 and Appendix A3.
 *
 * The rule these functions exist to enforce: a delivery or a minimum call-out
 * is charged per event, not per item ("Доставки и минимальные выезды считаются
 * на соответствующее мероприятие, а не по одному разу на каждую сваю").
 */

export interface ModuleTransportInput {
  /** Physically transported units, not rooms (§A3: "по числу транспортируемых единиц"). */
  transportedModuleCount: number;
  deliveryPricePerModuleRub: Money;
  craneRatePerHourRub: Money;
  /** Reference figure, editable: ~2 h per module. */
  craneHoursPerModule: number;
}

export interface ModuleTransportResult {
  deliveryCostRub: Money;
  craneHours: number;
  craneCostRub: Money;
}

export function moduleTransport(input: ModuleTransportInput): ModuleTransportResult {
  if (!Number.isInteger(input.transportedModuleCount) || input.transportedModuleCount <= 0) {
    throw new CalcError("Некорректное число транспортируемых модулей", "INVALID_MODULE_COUNT");
  }
  const craneHours = input.transportedModuleCount * input.craneHoursPerModule;
  return {
    deliveryCostRub: money(input.deliveryPricePerModuleRub).times(input.transportedModuleCount),
    craneHours,
    craneCostRub: money(input.craneRatePerHourRub).times(craneHours),
  };
}

/**
 * A per-event budget (materials delivery to the workshop, people/fuel to the
 * site). Charged once per its event, however many items it carried.
 */
export interface TripBudget {
  name: string;
  amountRub: Money;
  /** How many separate trips actually happened - default one. */
  tripCount?: number;
}

export function tripBudgetCost(budget: TripBudget): Money {
  const trips = budget.tripCount ?? 1;
  if (!Number.isInteger(trips) || trips <= 0) {
    throw new CalcError(`Некорректное число выездов для "${budget.name}"`, "INVALID_TRIP_COUNT");
  }
  return money(budget.amountRub).times(trips);
}

/**
 * Equipment call-outs for the foundation: the machine is charged by the hour
 * and its delivery per call-out. Adding four boiler-room piles to an existing
 * visit does not create a second delivery unless the visit really is separate
 * (§8).
 */
export interface EquipmentVisitInput {
  hours: number;
  ratePerHourRub: Money;
  deliveryPerVisitRub: Money;
  /** true only when this work genuinely needs its own separate trip. */
  isSeparateVisit: boolean;
}

export function equipmentVisitCost(input: EquipmentVisitInput): { workRub: Money; deliveryRub: Money } {
  if (input.hours < 0) throw new CalcError("Отрицательные часы техники", "NEGATIVE_HOURS");
  return {
    workRub: money(input.ratePerHourRub).times(input.hours),
    deliveryRub: input.isSeparateVisit ? money(input.deliveryPerVisitRub) : money(0),
  };
}
