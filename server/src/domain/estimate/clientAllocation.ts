import { d, toKopecks } from "@lhc/calc-engine";
import type { EstimateResult } from "./types.js";

export interface ClientBlockPrice {
  blockId: string;
  label: string;
  clientPrice: number;
}

/**
 * Раздел 21: клиентская смета показывает "цену каждого блока", а не только общий итог.
 * Себестоимость по блокам клиенту не сообщается — только результат распределения итоговой
 * продажной цены пропорционально долям прямых затрат. Раздел 18: "цена блоков суммируется
 * точно в цену предложения" — остаток округления относится на первый ценообразующий блок
 * явной отдельной корректировкой, а не прячется.
 */
export function allocateClientPricePerBlock(estimate: EstimateResult): ClientBlockPrice[] {
  const pricedBlocks = estimate.blocks.filter((b) => b.id !== "overhead");
  const totalKnownCost = pricedBlocks.reduce((acc, b) => acc + b.subtotal, 0);

  if (totalKnownCost <= 0) {
    return pricedBlocks.map((b) => ({ blockId: b.id, label: b.label, clientPrice: 0 }));
  }

  const allocations = pricedBlocks.map((b) => ({
    blockId: b.id,
    label: b.label,
    clientPrice: toKopecks(d(estimate.pricing.price).times(b.subtotal).dividedBy(totalKnownCost)).toNumber(),
  }));

  const sumAllocated = allocations.reduce((acc, a) => acc + a.clientPrice, 0);
  const roundingRemainder = toKopecks(d(estimate.pricing.price).minus(sumAllocated)).toNumber();
  if (roundingRemainder !== 0 && allocations.length > 0) {
    allocations[0].clientPrice = toKopecks(d(allocations[0].clientPrice).plus(roundingRemainder)).toNumber();
  }

  return allocations;
}
