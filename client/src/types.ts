export interface EstimateLineView {
  id: string;
  label: string;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  amount?: number | null;
  status: string;
  note?: string | null;
  costCategory?: string;
  hasValue?: boolean;
}

export interface EstimateBlockView {
  id: string;
  label: string;
  lines: EstimateLineView[];
  subtotal?: number;
  hasGaps: boolean;
}

export interface EstimateGap {
  code: string;
  message: string;
  blocksFinal: boolean;
}

export interface OwnerEstimateView {
  blocks: EstimateBlockView[];
  directCostsD: number;
  reserveR: number;
  overheadO: number;
  amortizationA: number;
  fullCostC: number;
  pricing: {
    price: number;
    tax: number;
    commission: number;
    profit: number;
    markupPct: number;
    marginAfterCostsPct: number;
  };
  gaps: EstimateGap[];
}

export interface ManagerEstimateView {
  blocks: EstimateBlockView[];
  clientPrice: { recommendedPrice: number; minimumAllowedPrice: number; allowedDiscountPct: number };
  gaps: EstimateGap[];
}

export interface WorkshopEstimateView {
  blocks: EstimateBlockView[];
}

export type AnyEstimateView = OwnerEstimateView | ManagerEstimateView | WorkshopEstimateView;

export interface ProjectSummary {
  id: string;
  name: string;
  catalogTemplateId: string;
  familyType: "BARN" | "NORMA";
  createdAt: string;
  customer?: { name: string } | null;
  variants?: { id: string; label: string; status: string }[];
}

export interface CatalogProject {
  id: string;
  name: string;
  family: "BARN" | "NORMA";
  insideByExplicationM2: number;
  openZonesM2: Record<string, number>;
  closedFootprintM2: number;
  pages: number;
  rooms: { name: string; areaM2: number }[];
  footprintNote: string;
  rectFootprint?: { spanM: number; lengthM: number; confidence: string; note: string } | null;
  sourceFileAvailable: boolean;
  pileFieldTemplate?: string;
  versionConflicts?: string[];
}
