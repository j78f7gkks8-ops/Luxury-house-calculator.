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
  /**
   * null = "объём не определён" - a required line whose quantity the available
   * data cannot give. Zero, unknown and excluded are three different states
   * (§6), so an unknown quantity is never collapsed to 0.
   */
  qty: number | null;
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

/**
 * Where this calculation's inputs come from and whether its total may be
 * called a full cost. Catalog (website) data is a source revision, never an
 * approved production spec (catalog import rules 1, 12, 15).
 */
export interface ReadinessSummary {
  level: "CATALOG_PRELIMINARY" | "OWNER_APPROVED";
  /** false => the sum is a partial estimate and must never be shown as полная себестоимость. */
  isFullCost: boolean;
  /** Required blocks the current data cannot supply, in plain Russian. */
  gaps: string[];
  /** Assumptions a human accepted to get this far. */
  assumptions: string[];
}

/** The catalog model this calculation was started from, with its areas kept separate (rules 4, 5). */
export interface CatalogReference {
  projectId: string;
  displayName: string;
  nameAliases: string[];
  category: "house" | "sauna";
  sourceUrl: string;
  planImagePath: string | null;
  planReviewStatus: string;
  advertisedAreaM2: number | null;
  areaDefinition: string | null;
  labeledIndoorAreaSumM2: number | null;
  labeledOutdoorAreaSumM2: number | null;
  terraceLabeledAreaM2: number | null;
  enclosedBodyGrossAreaM2: number | null;
  advertisedVsLabeledDeltaM2: number | null;
  ceilingHeightM: number | null;
  roofText: string | null;
  issues: { code: string; message: string }[];
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
  readiness: ReadinessSummary;
  /** Present when the calculation was started from a catalog model. */
  catalogRef?: CatalogReference;
  pileSummary: {
    /**
     * null = свайное поле не определено. Never derived by dividing an
     * advertised area by a norm (catalog rule 10) - it needs a module scheme,
     * binding lines, terrace and porches.
     */
    totalPiles: number | null;
    variantName: string;
    bindingLengthMm: number | null;
    source: string;
  };
}

export const CALC_ENGINE_VERSION = "1.1.0";

/** Renders a quantity for humans, keeping "unknown" distinct from zero (§6). */
export function formatQty(qty: number | null, unit?: string): string {
  if (qty === null) return "объём не определён";
  return unit ? `${qty} ${unit}` : String(qty);
}
