import { HouseFamily } from "./enums";

/** Commercial blocks - §5. A technical line always points at exactly one of these. */
export const COMMERCIAL_BLOCKS = [
  "SHELL", // Дом без внутренней отделки
  "INTERIOR", // Внутренняя отделка и внутренние системы
  "FOUNDATION", // Фундамент
  "EXTERNAL_UTILITIES", // Наружные коммуникации
  "LOGISTICS", // Перевозка, погрузка, разгрузка
  "INSTALLATION", // Монтаж дома
  "OPTIONS", // Дополнительные опции
] as const;
export type CommercialBlock = (typeof COMMERCIAL_BLOCKS)[number];

export const COMMERCIAL_BLOCK_LABELS: Record<CommercialBlock, string> = {
  SHELL: "Дом без внутренней отделки",
  INTERIOR: "Внутренняя отделка и внутренние системы",
  FOUNDATION: "Фундамент",
  EXTERNAL_UTILITIES: "Наружные коммуникации",
  LOGISTICS: "Перевозка, погрузка и разгрузка",
  INSTALLATION: "Монтаж дома",
  OPTIONS: "Дополнительные опции",
};

export type LineCostCategory =
  | "MATERIAL"
  | "LABOR"
  | "SUBCONTRACT"
  | "EQUIPMENT"
  | "DELIVERY"
  | "CONSUMABLES";

export type QuantitySourceStatus =
  | "CONFIRMED"
  | "PER_DRAWING_NEEDS_CHECK"
  | "PRELIMINARY_BY_ANALOGY"
  | "PRICE_NEEDED"
  | "SIZE_NEEDED"
  | "VERSION_CONFLICT"
  | "NOT_IN_ORDER"
  | "INCLUDED_IN_PACKAGE"
  | "REPLACED";

/** One priced technical line - the atomic unit shown at the deepest drill-down level (§2). */
export interface CompositionLine {
  key: string;
  block: CommercialBlock;
  category: LineCostCategory;
  name: string;
  qty: number;
  unit: string;
  unitCostRub: number | null; // null = "цена не задана", never treated as free
  totalCostRub: number | null;
  status: QuantitySourceStatus;
  source: string;
  formulaExplanation: string;
  ownerOptionId: string; // "BASE" or an option id, for traceability
}

export interface LaborStageSummary {
  name: string;
  people: number;
  days: number;
  hoursPerDay: number;
  hours: number;
  ratePerHourRub: number;
  costRub: number;
}

export interface CostSummary {
  directCostsRub: number; // D
  reserveFraction: number;
  reserveRub: number; // R
  overheadRub: number; // O (incl. amortization)
  fullCostRub: number; // C = D + R + O
  knownLinesTotal: number;
  linesWithMissingPrice: string[]; // keys with unitCostRub === null
}

export type PricingMode = "MARKUP" | "TARGET_PROFIT_RUB" | "TARGET_PROFIT_SHARE";

export interface PriceSummary {
  mode: PricingMode;
  rawPriceRub: number;
  roundedPriceRub: number;
  roundingDeltaRub: number;
  taxRub: number;
  commissionRub: number;
  profitRub: number;
  markup: number;
  marginAfterTaxCommission: number;
  minimumAllowedPriceRub: number;
  baseProfitProtected: boolean;
}

export interface ClientDescriptionBlock {
  block: CommercialBlock;
  title: string;
  items: string[]; // human-readable, per §21 - only what was actually selected
  priceRub: number | null;
}

export interface EstimateSnapshot {
  calcEngineVersion: string;
  houseFamily: HouseFamily;
  templateId: string;
  templateLabel: string;
  createdAt: string;
  /** The exact inputs used to compute this snapshot - allows "recalculate with new prices" to reproduce it. */
  templateInput?: unknown;
  selectedOptionIds: string[];
  optionConflicts: string[];
  compositionLines: CompositionLine[];
  laborStages: LaborStageSummary[];
  costSummary: CostSummary;
  priceSummary: PriceSummary;
  clientDescription: ClientDescriptionBlock[];
  pileSummary: {
    totalPiles: number;
    variantName: string;
    bindingLengthMm: number;
  };
}

export const CALC_ENGINE_VERSION = "1.0.0";
