import { AppRole } from "./enums";
import { CompositionLine, EstimateSnapshot, LaborStageSummary } from "./snapshot";

/**
 * Permission matrix - §3. Every API route and export must call one of these
 * (never trust a client-side tab switch as access control).
 */
export const permissions = {
  canViewAllProjects: (role: AppRole) => role === "OWNER",
  canViewCostBreakdown: (role: AppRole) => role === "OWNER",
  canViewPurchasePricesAndRates: (role: AppRole) => role === "OWNER",
  canViewMinimumAllowedPrice: (role: AppRole) => role === "MANAGER" || role === "OWNER",
  canViewProfitMarginTaxCommission: (role: AppRole) => role === "OWNER",
  canSetPriceWithinLimits: (role: AppRole) => role === "MANAGER" || role === "OWNER",
  canApproveDiscountBelowFloor: (role: AppRole) => role === "OWNER",
  canEditApprovedNormsAndSpecs: (role: AppRole) => role === "OWNER",
  canRequestNormChange: (role: AppRole) => role === "SHOP",
  canEnterShopProgress: (role: AppRole) => role === "SHOP" || role === "OWNER",
  canSelectCompositionAndPrice: (role: AppRole) => role === "MANAGER" || role === "OWNER",
  canExportClientEstimate: (role: AppRole) => role === "MANAGER" || role === "OWNER",
  canExportProductionTask: (role: AppRole) => role === "SHOP" || role === "OWNER",
  canExportFullInternalEstimate: (role: AppRole) => role === "OWNER",
  canManageCatalogsAndPolicy: (role: AppRole) => role === "OWNER",
} as const;

function redactCompositionLineForShop(l: CompositionLine): CompositionLine {
  return {
    ...l,
    unitCostRub: null,
    totalCostRub: null,
    formulaExplanation: l.formulaExplanation.replace(/x [\d.,]+ ₽|цена не задана/gi, "").trim(),
  };
}

function redactCompositionLineForManager(l: CompositionLine): CompositionLine {
  return { ...l, unitCostRub: null, totalCostRub: null };
}

function redactLaborForShop(s: LaborStageSummary): LaborStageSummary {
  return { ...s, ratePerHourRub: 0, costRub: 0 };
}

/**
 * Role-appropriate view of a computed estimate. This is the single place
 * that decides what leaves the server for each role - API routes and
 * exporters must build their payloads through this, never by hand-picking
 * fields (§3: "Не отдавай запрещённые данные в JSON, HTML, клиентское
 * хранилище, скрытые колонки XLSX или общий PDF").
 */
export function redactSnapshotForRole(snapshot: EstimateSnapshot, role: AppRole): EstimateSnapshot {
  if (role === "OWNER") return snapshot;

  if (role === "SHOP") {
    return {
      ...snapshot,
      compositionLines: snapshot.compositionLines.map(redactCompositionLineForShop),
      laborStages: snapshot.laborStages.map(redactLaborForShop),
      costSummary: {
        directCostsRub: 0,
        reserveFraction: 0,
        reserveRub: 0,
        overheadRub: 0,
        fullCostRub: 0,
        knownLinesTotal: 0,
        linesWithMissingPrice: [],
      },
      priceSummary: {
        mode: snapshot.priceSummary.mode,
        rawPriceRub: 0,
        roundedPriceRub: 0,
        roundingDeltaRub: 0,
        taxRub: 0,
        commissionRub: 0,
        profitRub: 0,
        markup: 0,
        marginAfterTaxCommission: 0,
        minimumAllowedPriceRub: 0,
        baseProfitProtected: snapshot.priceSummary.baseProfitProtected,
      },
      clientDescription: [], // shop gets the production task, not the client-facing offer
    };
  }

  // MANAGER: sees composition, quantities and the final price/floor, never the cost breakdown.
  return {
    ...snapshot,
    compositionLines: snapshot.compositionLines.map(redactCompositionLineForManager),
    costSummary: {
      directCostsRub: 0,
      reserveFraction: 0,
      reserveRub: 0,
      overheadRub: 0,
      fullCostRub: 0,
      knownLinesTotal: snapshot.costSummary.knownLinesTotal,
      linesWithMissingPrice: snapshot.costSummary.linesWithMissingPrice,
    },
    priceSummary: {
      mode: snapshot.priceSummary.mode,
      rawPriceRub: snapshot.priceSummary.rawPriceRub,
      roundedPriceRub: snapshot.priceSummary.roundedPriceRub,
      roundingDeltaRub: snapshot.priceSummary.roundingDeltaRub,
      taxRub: 0,
      commissionRub: 0,
      profitRub: 0,
      markup: 0,
      marginAfterTaxCommission: 0,
      minimumAllowedPriceRub: snapshot.priceSummary.minimumAllowedPriceRub,
      baseProfitProtected: snapshot.priceSummary.baseProfitProtected,
    },
  };
}
