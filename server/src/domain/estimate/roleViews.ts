import type { EstimateResult, EstimateBlock, EstimateLine } from "./types.js";
import type { Role } from "../roles.js";

/**
 * Раздел 3: таблица прав. Цех и Менеджер по умолчанию НЕ получают закупочные цены,
 * себестоимость, резерв, накладные и прибыль — ни в JSON, ни в производных полях.
 * Это единственная точка, где EstimateResult превращается в то, что уходит по сети.
 */

function stripLineMoney(l: EstimateLine): Omit<EstimateLine, "unitPrice" | "amount"> & { hasValue: boolean } {
  const { unitPrice, amount, ...rest } = l;
  return { ...rest, hasValue: amount !== null };
}

function stripBlockMoney(b: EstimateBlock) {
  return { id: b.id, label: b.label, hasGaps: b.hasGaps, lines: b.lines.map(stripLineMoney) };
}

export interface WorkshopEstimateView {
  blocks: ReturnType<typeof stripBlockMoney>[];
  engineVersion: string;
}

export function toWorkshopView(result: EstimateResult): WorkshopEstimateView {
  return { blocks: result.blocks.map(stripBlockMoney), engineVersion: result.engineVersion };
}

export interface ManagerEstimateView {
  blocks: ReturnType<typeof stripBlockMoney>[];
  clientPrice: {
    recommendedPrice: number;
    minimumAllowedPrice: number;
    allowedDiscountPct: number;
  };
  gaps: EstimateResult["gaps"];
  engineVersion: string;
}

const MANAGER_DEFAULT_ALLOWED_DISCOUNT_PCT = 5;

export function toManagerView(result: EstimateResult): ManagerEstimateView {
  const minimumAllowedPrice = result.pricing.price * (1 - MANAGER_DEFAULT_ALLOWED_DISCOUNT_PCT / 100);
  return {
    blocks: result.blocks.map(stripBlockMoney),
    clientPrice: {
      recommendedPrice: result.pricing.price,
      minimumAllowedPrice,
      allowedDiscountPct: MANAGER_DEFAULT_ALLOWED_DISCOUNT_PCT,
    },
    gaps: result.gaps,
    engineVersion: result.engineVersion,
  };
}

export function toOwnerView(result: EstimateResult): EstimateResult {
  return result;
}

export function projectEstimateForRole(result: EstimateResult, role: Role): EstimateResult | ManagerEstimateView | WorkshopEstimateView {
  switch (role) {
    case "OWNER":
      return toOwnerView(result);
    case "MANAGER":
      return toManagerView(result);
    case "WORKSHOP":
      return toWorkshopView(result);
  }
}
