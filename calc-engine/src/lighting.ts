import { d, Num } from "./decimal.js";

/**
 * Раздел 12/А2/23 п.17: освещение. Пять треков — не пять трековых головок; LED-люстры со
 * встроенным источником света не потребляют лампы GU10.
 */
export interface LampConsumerGroup {
  label: string;
  count: number;
  patronsPerUnit: number;
  hasBuiltInLed: boolean;
}

export function totalGu10Lamps(groups: LampConsumerGroup[]): number {
  return groups.filter((g) => !g.hasBuiltInLed).reduce((sum, g) => sum + g.count * g.patronsPerUnit, 0);
}

export function lampReserveCount(baseCount: number, reservePct: Num = 10): number {
  return d(baseCount).times(d(reservePct).dividedBy(100)).ceil().toNumber();
}

export function totalGu10LampsWithReserve(groups: LampConsumerGroup[], reservePct: Num = 10): { base: number; reserve: number; total: number } {
  const base = totalGu10Lamps(groups);
  const reserve = lampReserveCount(base, reservePct);
  return { base, reserve, total: base + reserve };
}
