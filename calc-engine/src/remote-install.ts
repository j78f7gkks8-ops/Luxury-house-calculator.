import { Decimal, d, Num } from "./decimal.js";
import { humanHours, laborCost, siteAllowance } from "./labor.js";

/**
 * Раздел 16.1: монтаж на удалении — самостоятельная модель затрат. Увеличение расстояния
 * растягивает срок (дни), но НЕ умножает материалы дома, доставку модулей или фундамент
 * (раздел 23 п.20.1: "20 дней вместо 10... материал дома, доставка модулей и фундамент не
 * умножены на 2").
 */
export interface RemoteInstallLaborInput {
  people: Num;
  days: Num;
  hoursPerDay: Num;
  ratePerHour: Num;
  allowancePerPersonPerDay: Num;
}

export interface RemoteInstallLaborResult {
  hours: Decimal;
  laborCost: Decimal;
  allowanceCost: Decimal;
  totalLaborCost: Decimal;
}

export function computeRemoteInstallLabor(input: RemoteInstallLaborInput): RemoteInstallLaborResult {
  const hours = humanHours(input.people, input.days, input.hoursPerDay);
  const labor = laborCost(hours, input.ratePerHour);
  const allowance = siteAllowance(input.people, input.days, input.allowancePerPersonPerDay);
  return { hours, laborCost: labor, allowanceCost: allowance, totalLaborCost: labor.plus(allowance) };
}

export interface TripInput {
  oneWayDistanceKm: Num;
  roundTrips: number;
  vehicles: number;
}

/** Суммарный пробег = 2 × расстояние в одну сторону × число поездок туда-обратно × число автомобилей. */
export function tripMileageKm(trip: TripInput): Decimal {
  return d(2).times(trip.oneWayDistanceKm).times(trip.roundTrips).times(trip.vehicles);
}

export function totalMileageKm(trips: TripInput[]): Decimal {
  return trips.reduce((acc, t) => acc.plus(tripMileageKm(t)), d(0));
}

export function fuelCost(mileageKm: Num, litersPer100Km: Num, pricePerLiter: Num): Decimal {
  return d(mileageKm).times(litersPer100Km).dividedBy(100).times(pricePerLiter);
}
