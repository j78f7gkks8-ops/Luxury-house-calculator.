import type { Finish, WindowShape } from "@lhc/calc-engine";

export type LineStatus =
  | "confirmed"
  | "from_drawing_needs_check"
  | "preliminary_by_analog"
  | "needs_price"
  | "needs_size"
  | "version_conflict"
  | "included_in_package";

export interface EstimateLine {
  id: string;
  label: string;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  amount: number | null; // null означает "неизвестно", НЕ ноль
  status: LineStatus;
  note?: string | null;
  costCategory: "material" | "labor" | "subcontract" | "equipment" | "delivery" | "consumable" | "reserve" | "overhead" | "tax" | "commission";
}

export interface EstimateBlock {
  id: string;
  label: string;
  lines: EstimateLine[];
  subtotal: number; // сумма известных строк; неизвестные не входят, но видны как gaps
  hasGaps: boolean;
}

export interface EstimateGap {
  code: string;
  message: string;
  blocksFinal: boolean;
}

export interface WindowSelectionInput {
  id: string;
  label: string;
  productId: string; // W1..W4, D1, P1..P5, или "custom"
  referenceFinish: Finish;
  targetFinish: Finish;
  widthMm: number;
  heightMm?: number;
  shape: WindowShape;
  heightLeftMm?: number;
  heightRightMm?: number;
  qty: number;
  facadeId?: string;
  replacesOpeningIds?: string[];
}

export interface OptionSelectionInput {
  id: string;
  label: string;
  category: "finish" | "heating" | "plumbing" | "electrical" | "utilities" | "addon";
  priceRub?: number | null;
  laborHours?: number | null;
  status: LineStatus;
  note?: string | null;
}

export interface FoundationSelectionInput {
  template: "barn96_kyzyl" | "norma77" | "generic_analog" | "manual";
  terraceDepthM?: number;
  manualPileCount?: number;
  includeIndependentKotelnaya?: boolean;
}

export interface PricingSelectionInput {
  mode: "markup" | "target_profit_absolute" | "target_profit_share";
  markupK?: number;
  targetProfitG?: number;
  targetShareG?: number;
  taxRateT: number;
  managerCommissionM: number;
  roundingStep?: number;
}

export interface EstimateSelection {
  catalogTemplateId: string;
  family: "BARN" | "NORMA";
  insideAreaM2: number;
  closedFootprintM2: number;
  terraceAreaM2?: number;
  porchAreaM2?: number;
  windows: WindowSelectionInput[];
  options: OptionSelectionInput[];
  foundation: FoundationSelectionInput;
  pricing: PricingSelectionInput;
  installDistanceKm?: number;
  installDaysOverride?: number;
}

export interface EstimateResult {
  blocks: EstimateBlock[];
  directCostsD: number;
  reserveR: number;
  overheadO: number;
  amortizationA: number;
  fullCostC: number;
  pricing: {
    priceBeforeRounding: number;
    price: number;
    tax: number;
    commission: number;
    profit: number;
    markupPct: number;
    marginAfterCostsPct: number;
  };
  gaps: EstimateGap[];
  engineVersion: string;
}
