import { CalcError, money, round, toRubles } from "../../calc/money";
import { monthlyOverhead, annualOverhead, overheadPerHouseEqualSplit, fullOverheadPerHouse } from "../../calc/overhead";
import {
  priceByMarkup,
  priceByTargetProfit,
  priceByTargetProfitShare,
  evaluatePrice,
  applyRoundingPolicy,
} from "../../calc/pricing";
import { applyOptions, OptionDefinition, OwnedLine } from "../../calc/options";
import { packLoopsIntoCoils, pipeLengthForZoneM } from "../../calc/floorHeating";
import { showerCornerAreaM2 } from "../../calc/finishes";
import { CatalogProject } from "../../catalog/schema";
import { advertisedVsLabeledDeltaM2, isBlockedForCalculation, missingForCostingKeys } from "../../catalog/parse";
import { OVERHEAD_STARTING_POLICY, PRICING_STARTING_POLICY, REFERENCE_PRICES } from "../referenceData";
import {
  CALC_ENGINE_VERSION,
  ClientDescriptionBlock,
  COMMERCIAL_BLOCK_LABELS,
  CatalogReference,
  CommercialBlock,
  CompositionLine,
  CostSummary,
  EstimateSnapshot,
  PriceSummary,
  PricingMode,
  ReadinessSummary,
} from "../snapshot";
import { HouseFamily } from "../enums";

/**
 * Preliminary calculation for any of the 20 catalog models.
 *
 * The catalog is website source data, not an approved production spec, so this
 * builder is deliberately conservative:
 *  - it never invents a pile count from an advertised area (rule 10);
 *  - it never treats null as zero (rule 8);
 *  - it never mixes the advertised area with the sum of labelled rooms (rules 4, 5);
 *  - it refuses to calculate at all for a model whose published plan
 *    contradicts its own card (rule 13, БАРН 48);
 *  - it marks the result as an incomplete preliminary estimate so no caller
 *    can present the sum as полная себестоимость (rule 15).
 *
 * Anything the site cannot give appears as a visible gap line with qty = null,
 * not as a missing row and not as zero.
 */

export interface CatalogProjectInput {
  selectedOptionIds: string[];
  pricingMode?: PricingMode;
  markupFraction?: number;
  targetProfitRub?: number;
  targetProfitShare?: number;
  taxFraction?: number;
  commissionFraction?: number;
  totalRoundingStepRub?: number;
}

/** Generic options whose quantities come from THIS project's own plan figures (rule 16). */
export const GENERIC_CATALOG_OPTIONS = [
  { id: "warm-floor", label: "Водяной тёплый пол (по подписанной внутренней площади)" },
  { id: "terrace-decking", label: "Настил террасы (по подписанной площади террасы)" },
  { id: "tile-bathroom", label: "Плитка санузла: душевой угол 1x1 м" },
] as const;

const OSB_12MM_PER_M2_RUB = 1120 / (1.25 * 2.5);

function houseFamilyFrom(p: CatalogProject): HouseFamily {
  return p.website_specs.roof_family_hint === "gable" ? "BARN" : "NORMA_FLAT_ROOF";
}

function blockFromKey(key: string): CommercialBlock {
  const prefix = key.split(":")[0];
  const map: Record<string, CommercialBlock> = {
    shell: "SHELL",
    interior: "INTERIOR",
    foundation: "FOUNDATION",
    external: "EXTERNAL_UTILITIES",
    logistics: "LOGISTICS",
    installation: "INSTALLATION",
    options: "OPTIONS",
  };
  return map[prefix ?? ""] ?? "OPTIONS";
}

/** Human-readable label for each `missing_for_costing` key the site leaves empty. */
const GAP_LABELS: Record<string, { name: string; block: CommercialBlock; unit: string }> = {
  approved_revision_id: { name: "Утверждённая редакция проекта", block: "SHELL", unit: "—" },
  production_module_count: { name: "Число производственных модулей", block: "SHELL", unit: "шт" },
  module_geometry: { name: "Геометрия и раскладка модулей", block: "SHELL", unit: "—" },
  pile_count: { name: "Количество свай", block: "FOUNDATION", unit: "шт" },
  pile_coordinates: { name: "Координаты свай и линии обвязки", block: "FOUNDATION", unit: "—" },
  structural_stud_height_mm: { name: "Высота стойки каркаса", block: "SHELL", unit: "мм" },
  roof_slope_deg: { name: "Уклон и узлы кровли", block: "SHELL", unit: "град" },
  structural_bom: { name: "Ведомость деталей каркаса", block: "SHELL", unit: "—" },
  finish_schedule: { name: "Отделочная ведомость", block: "INTERIOR", unit: "—" },
  engineering_bom: { name: "Инженерная спецификация (электрика, вода, отопление)", block: "INTERIOR", unit: "—" },
  labor_hours: { name: "Человеко-часы по операциям", block: "INSTALLATION", unit: "чел-час" },
  base_package_detailed_scope: { name: "Точный состав базовой комплектации", block: "SHELL", unit: "—" },
};

function gapLines(p: CatalogProject): CompositionLine[] {
  return missingForCostingKeys(p).map((key) => {
    const meta = GAP_LABELS[key] ?? { name: key, block: "SHELL" as CommercialBlock, unit: "—" };
    return {
      key: `gap:${key}`,
      block: meta.block,
      category: "MATERIAL" as const,
      name: meta.name,
      qty: null,
      unit: meta.unit,
      unitCostRub: null,
      totalCostRub: null,
      status: "SIZE_NEEDED" as const,
      source: "Сайт lhmodul.ru не публикует эти данные",
      formulaExplanation: "Заполняется из рабочих чертежей и норм владельца",
      ownerOptionId: "BASE",
    };
  });
}

function buildOptionDefs(p: CatalogProject): Record<string, OptionDefinition> {
  const defs: Record<string, OptionDefinition> = {};
  const indoorArea = p.floor_plan.derived_labeled_indoor_area_sum_m2;
  const terraceArea = p.floor_plan.terrace_labeled_area_m2;

  if (indoorArea !== null) {
    const pipeLengthM = pipeLengthForZoneM(indoorArea, REFERENCE_PRICES.warmFloorPipeNormPerM2);
    const loopLimitM = 60;
    const loopCount = Math.max(1, Math.ceil(pipeLengthM / loopLimitM));
    const loopLengths = Array.from({ length: loopCount }, (_, i) =>
      i < loopCount - 1 ? loopLimitM : pipeLengthM - loopLimitM * (loopCount - 1),
    );
    const coilPack = packLoopsIntoCoils(loopLengths, 200);
    defs["warm-floor"] = {
      id: "warm-floor",
      actions: [
        {
          type: "ADD",
          key: "interior:floor:warm-coils",
          line: { material: "Бухты трубы тёплого пола, 200 м", qty: coilPack.coilsUsed, unit: "шт" },
        },
        {
          type: "ADD",
          key: "interior:floor:screed",
          line: { material: "Стяжка тёплого пола с работой", qty: indoorArea, unit: "m2" },
        },
        {
          type: "ADD",
          key: "interior:floor:warm-mesh",
          line: { material: "Сетка 4мм 150x150 под стяжку", qty: indoorArea, unit: "m2" },
        },
      ],
    };
  }

  if (terraceArea !== null) {
    defs["terrace-decking"] = {
      id: "terrace-decking",
      actions: [
        {
          type: "ADD",
          key: "shell:terrace:decking",
          line: { material: "Палубная доска террасы 27 мм", qty: terraceArea, unit: "m2" },
        },
      ],
    };
  }

  // Only offered when the card actually reports a bathroom; a missing count is
  // unknown, not "no bathroom" (rule 8).
  if (p.website_specs.bathrooms_count !== null && p.website_specs.bathrooms_count > 0) {
    defs["tile-bathroom"] = {
      id: "tile-bathroom",
      actions: [
        {
          type: "ADD",
          key: "interior:bathroom:tile-shower",
          line: {
            material: "Плитка душевой зоны (пол + 2 стены 2.5 м)",
            qty: showerCornerAreaM2(1, 1, 2.5, 2),
            unit: "m2",
          },
        },
        {
          type: "ADD",
          key: "interior:bathroom:tile-base",
          line: {
            material: "Основание плитки (комплекс ГВЛ/гидроизоляция/клей/работа)",
            qty: showerCornerAreaM2(1, 1, 2.5, 2),
            unit: "m2",
          },
        },
      ],
    };
  }

  return defs;
}

const UNIT_PRICE_LOOKUP: Record<string, number | null> = {
  "Черновой пол OSB 12мм": OSB_12MM_PER_M2_RUB,
  "Бухты трубы тёплого пола, 200 м": 200 * REFERENCE_PRICES.warmFloorPipePricePerMRub,
  "Стяжка тёплого пола с работой": REFERENCE_PRICES.warmFloorScreedPerM2Rub,
  "Сетка 4мм 150x150 под стяжку": REFERENCE_PRICES.warmFloorMeshPerM2Rub,
  "Палубная доска террасы 27 мм": 1750,
  "Плитка душевой зоны (пол + 2 стены 2.5 м)": REFERENCE_PRICES.tilePerM2Rub,
  "Основание плитки (комплекс ГВЛ/гидроизоляция/клей/работа)": REFERENCE_PRICES.tileBasePackagePerM2Rub,
};

function ownedLinesToCompositionLines(lines: OwnedLine[], planSource: string): CompositionLine[] {
  return lines.map((l) => {
    const unitCost = UNIT_PRICE_LOOKUP[l.line.material] ?? null;
    const qty = Math.round(l.line.qty * 100) / 100;
    const totalCost = unitCost === null ? null : unitCost * qty;
    return {
      key: l.key,
      block: blockFromKey(l.key),
      category: "MATERIAL" as const,
      name: l.line.material,
      qty,
      unit: l.line.unit,
      unitCostRub: unitCost,
      totalCostRub: totalCost,
      // Quantities come from a visually transcribed plan, never production-verified.
      status: "PRELIMINARY_BY_ANALOGY" as const,
      source: l.ownerOptionId === "BASE" ? planSource : `Опция: ${l.ownerOptionId} (объём по плану сайта)`,
      formulaExplanation: `${qty} ${l.line.unit} x ${unitCost ?? "цена не задана"} ₽ - предварительно по подписям плана`,
      ownerOptionId: l.ownerOptionId,
    };
  });
}

function catalogReference(p: CatalogProject): CatalogReference {
  return {
    projectId: p.project_id,
    displayName: p.display_name,
    nameAliases: p.name_aliases,
    category: p.category,
    sourceUrl: p.source_url,
    planImagePath: p.floor_plan.file_in_bundle ? `/${p.floor_plan.file_in_bundle}` : null,
    planReviewStatus: p.floor_plan.review_status,
    advertisedAreaM2: p.website_specs.advertised_area_m2,
    areaDefinition: p.website_specs.area_definition,
    labeledIndoorAreaSumM2: p.floor_plan.derived_labeled_indoor_area_sum_m2,
    labeledOutdoorAreaSumM2: p.floor_plan.derived_labeled_outdoor_area_sum_m2,
    terraceLabeledAreaM2: p.floor_plan.terrace_labeled_area_m2,
    enclosedBodyGrossAreaM2: p.floor_plan.enclosed_body_gross_area_from_dimensions_m2,
    advertisedVsLabeledDeltaM2: advertisedVsLabeledDeltaM2(p),
    ceilingHeightM: p.website_specs.ceiling_height_m,
    roofText: p.website_specs.roof_text,
    issues: p.issues,
  };
}

export function buildCatalogProjectSnapshot(p: CatalogProject, input: CatalogProjectInput): EstimateSnapshot {
  if (isBlockedForCalculation(p)) {
    throw new CalcError(
      `Расчёт по модели "${p.display_name}" заблокирован: опубликованный план противоречит карточке. ` +
        `Требуется подтверждение геометрии владельцем.`,
      "CATALOG_PLAN_CONFLICT",
      { projectId: p.project_id, issues: p.issues },
    );
  }

  const rates = {
    taxFraction: input.taxFraction ?? PRICING_STARTING_POLICY.taxFraction,
    commissionFraction: input.commissionFraction ?? PRICING_STARTING_POLICY.commissionFraction,
  };

  const planSource = `План сайта ${p.source_url} (${p.floor_plan.review_status})`;
  const optionDefs = buildOptionDefs(p);
  const selected = input.selectedOptionIds.filter((id) => optionDefs[id]);

  const indoorArea = p.floor_plan.derived_labeled_indoor_area_sum_m2;
  const baseOwnedLines: OwnedLine[] =
    indoorArea !== null
      ? [
          {
            key: "interior:floor:finish",
            ownerOptionId: "BASE",
            line: { material: "Черновой пол OSB 12мм", qty: indoorArea, unit: "m2" },
          },
        ]
      : [];

  const { lines: optionLines, conflicts } = applyOptions(baseOwnedLines, selected, optionDefs);
  const derivedLines = ownedLinesToCompositionLines(optionLines, planSource);
  const gaps = gapLines(p);
  const allLines = [...derivedLines, ...gaps];

  // Cost summary over what is actually known. This is explicitly NOT a full
  // cost - readiness.isFullCost stays false for every catalog calculation.
  const known = allLines.filter((l) => l.totalCostRub !== null);
  const directCostsRub = known.reduce((s, l) => s + (l.totalCostRub ?? 0), 0);
  const reserveFraction = PRICING_STARTING_POLICY.reserveFraction;
  const reserveRub = directCostsRub * reserveFraction;

  const monthly = monthlyOverhead([
    { name: "ads", monthlyAmount: money(OVERHEAD_STARTING_POLICY.adsMonthlyRub), applicableShare: OVERHEAD_STARTING_POLICY.adsModularShare },
    { name: "office", monthlyAmount: money(OVERHEAD_STARTING_POLICY.officeMonthlyRub) },
    { name: "workshop-rent", monthlyAmount: money(OVERHEAD_STARTING_POLICY.workshopRentMonthlyRub) },
    { name: "electricity", monthlyAmount: money(OVERHEAD_STARTING_POLICY.electricityMonthlyRub) },
  ]);
  const overheadRub = toRubles(
    fullOverheadPerHouse(
      overheadPerHouseEqualSplit(annualOverhead(monthly), OVERHEAD_STARTING_POLICY.plannedComparableHousesPerYear),
      money(OVERHEAD_STARTING_POLICY.toolAmortizationPerHouseRub),
    ),
  );
  const fullCostRub = directCostsRub + reserveRub + overheadRub;

  const costSummary: CostSummary = {
    directCostsRub,
    reserveFraction,
    reserveRub,
    overheadRub,
    fullCostRub,
    knownLinesTotal: known.length,
    linesWithMissingPrice: allLines.filter((l) => l.totalCostRub === null).map((l) => l.key),
  };

  const mode = input.pricingMode ?? "MARKUP";
  let raw;
  if (mode === "TARGET_PROFIT_SHARE") {
    raw = priceByTargetProfitShare(money(fullCostRub), input.targetProfitShare ?? 0.2, rates);
  } else if (mode === "TARGET_PROFIT_RUB") {
    raw = priceByTargetProfit(money(fullCostRub), money(input.targetProfitRub ?? 500000), rates);
  } else {
    raw = priceByMarkup(money(fullCostRub), input.markupFraction ?? 0.3);
  }
  const { roundedTotal, roundingDelta } = applyRoundingPolicy(round(raw, 2), {
    totalStep: money(input.totalRoundingStepRub ?? 1000),
  });
  const evaluation = evaluatePrice(roundedTotal, money(fullCostRub), rates);

  const priceSummary: PriceSummary = {
    mode,
    rawPriceRub: toRubles(raw),
    roundedPriceRub: toRubles(roundedTotal),
    roundingDeltaRub: toRubles(roundingDelta),
    taxRub: toRubles(evaluation.tax),
    commissionRub: toRubles(evaluation.commission),
    profitRub: toRubles(evaluation.profit),
    markup: evaluation.markup,
    marginAfterTaxCommission: evaluation.marginAfterTaxCommission,
    minimumAllowedPriceRub: toRubles(roundedTotal),
    baseProfitProtected: false,
  };

  const readiness: ReadinessSummary = {
    level: "CATALOG_PRELIMINARY",
    isFullCost: false,
    // Production blocks still to be confirmed. Source discrepancies are NOT
    // listed here: they are internal notes for the owner (rule 14) and travel
    // in catalogRef.issues, so they never reach a client document.
    gaps: gaps.map((g) => g.name),
    assumptions: [
      `Площади взяты с подписей плана сайта (${p.floor_plan.area_use ?? "reference_only"}), не из утверждённой редакции.`,
      "Свайное поле не рассчитано: нужна схема модулей и обвязки, а не деление площади на норматив.",
      p.website_specs.ceiling_height_m !== null
        ? `Высота потолка ${p.website_specs.ceiling_height_m} м - рекламная карточка, не длина стойки каркаса.`
        : "Высота потолка на карточке не указана.",
    ],
  };

  // The client-facing description lists only what was actually selected and
  // priced. Internal production gaps ("число модулей", "утверждённая редакция")
  // are not client language (§21) - they travel in readiness.gaps instead and
  // the client document summarises them in one plain sentence.
  const byBlock = new Map<CommercialBlock, CompositionLine[]>();
  for (const l of derivedLines) {
    if (!byBlock.has(l.block)) byBlock.set(l.block, []);
    byBlock.get(l.block)!.push(l);
  }
  const clientDescription: ClientDescriptionBlock[] = Array.from(byBlock.entries()).map(([block, blockLines]) => ({
    block,
    title: COMMERCIAL_BLOCK_LABELS[block],
    items: blockLines.map((l) => `${l.name}: ${l.qty === null ? "объём не определён" : `${l.qty} ${l.unit}`}`),
    priceRub: blockLines.some((l) => l.totalCostRub === null)
      ? null
      : blockLines.reduce((s, l) => s + (l.totalCostRub ?? 0), 0),
  }));

  return {
    calcEngineVersion: CALC_ENGINE_VERSION,
    houseFamily: houseFamilyFrom(p),
    templateId: `catalog:${p.project_id}`,
    templateLabel: p.display_name,
    createdAt: new Date().toISOString(),
    selectedOptionIds: selected,
    optionConflicts: conflicts,
    compositionLines: allLines,
    laborStages: [],
    costSummary,
    priceSummary,
    clientDescription,
    readiness,
    catalogRef: catalogReference(p),
    pileSummary: {
      totalPiles: null,
      variantName: "свайное поле не определено",
      bindingLengthMm: null,
      source: "Требуется схема модулей и обвязки (правило импорта 10)",
    },
  };
}
