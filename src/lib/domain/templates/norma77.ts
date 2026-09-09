import { money, toRubles } from "../../calc/money";
import { gridPileCount, bindingLengthMm, PILE_FASTENING_NORMS, PileGrid } from "../../calc/piles";
import { monthlyOverhead, annualOverhead, overheadPerHouseEqualSplit, fullOverheadPerHouse } from "../../calc/overhead";
import { priceByMarkup, priceByTargetProfit, priceByTargetProfitShare, evaluatePrice, applyRoundingPolicy, checkBaseProfitProtected } from "../../calc/pricing";
import { OVERHEAD_STARTING_POLICY, PRICING_STARTING_POLICY, REFERENCE_PRICES } from "../referenceData";
import { CALC_ENGINE_VERSION, ClientDescriptionBlock, COMMERCIAL_BLOCK_LABELS, CommercialBlock, CompositionLine, CostSummary, EstimateSnapshot, PriceSummary, PricingMode } from "../snapshot";

/**
 * §7: "новые модели добавляются через шаблоны, без копирования приложения и
 * переписывания формул". This is deliberately a thinner starter template
 * than Барн 96/Кызыл (Приложение Б gives Норма 77 far less confirmed
 * financial detail) - it proves the same engine handles a second house
 * family, honestly marked with fewer CONFIRMED lines.
 */

export interface Norma77Input {
  selectedOptionIds: string[];
  pricingMode?: PricingMode;
  markupFraction?: number;
  targetProfitRub?: number;
  targetProfitShare?: number;
  taxFraction?: number;
  commissionFraction?: number;
  totalRoundingStepRub?: number;
  minimumBaseProfitRub?: number;
}

const NORMA_77_GRID: PileGrid = {
  xCoordsMm: [0, 2925, 5031, 7138, 9244, 11350],
  yCoordsMm: [0, 2925, 5925, 8850],
};

function blockLabel(block: CommercialBlock) {
  return COMMERCIAL_BLOCK_LABELS[block];
}

export function buildNorma77Snapshot(input: Norma77Input): EstimateSnapshot {
  const rates = {
    taxFraction: input.taxFraction ?? PRICING_STARTING_POLICY.taxFraction,
    commissionFraction: input.commissionFraction ?? PRICING_STARTING_POLICY.commissionFraction,
  };
  const pileCount = gridPileCount(NORMA_77_GRID);
  const boltsCount = pileCount * PILE_FASTENING_NORMS.bindingToPileBoltsPerPile;
  const bindingCost = boltsCount * REFERENCE_PRICES.pileFasteningBoltRub;

  const lines: CompositionLine[] = [
    {
      key: "foundation:piles:main",
      block: "FOUNDATION",
      category: "MATERIAL",
      name: "Сваи основного поля",
      qty: pileCount,
      unit: "шт",
      unitCostRub: null,
      totalCostRub: null,
      status: "PRICE_NEEDED",
      source: "Норма 77 V2, поле 6x4",
      formulaExplanation: `${NORMA_77_GRID.xCoordsMm.length} x ${NORMA_77_GRID.yCoordsMm.length} = ${pileCount} свай; цена импортируется из счёта поставщика`,
      ownerOptionId: "BASE",
    },
    {
      key: "foundation:binding:bolts",
      block: "FOUNDATION",
      category: "MATERIAL",
      name: "Глухари 12x120 крепления обвязки к сваям",
      qty: boltsCount,
      unit: "шт",
      unitCostRub: REFERENCE_PRICES.pileFasteningBoltRub,
      totalCostRub: bindingCost,
      status: "CONFIRMED",
      source: "Норма владельца §8",
      formulaExplanation: `${pileCount} x 4 = ${boltsCount} шт x ${REFERENCE_PRICES.pileFasteningBoltRub} ₽`,
      ownerOptionId: "BASE",
    },
    {
      key: "shell:materials:not-detailed",
      block: "SHELL",
      category: "MATERIAL",
      name: "Каркас, утепление, кровля, фасад (полная ведомость не перенесена для этого шаблона)",
      qty: 1,
      unit: "компл",
      unitCostRub: null,
      totalCostRub: null,
      status: "SIZE_NEEDED",
      source: "Требуется загрузка рабочей сметы/чертежей Норма 77",
      formulaExplanation: "Нет подтверждённого объёма - шаблон ожидает спецификацию",
      ownerOptionId: "BASE",
    },
  ];

  const known = lines.filter((l) => l.totalCostRub !== null);
  const directCostsRub = known.reduce((s, l) => s + (l.totalCostRub ?? 0), 0);
  const reserveFraction = PRICING_STARTING_POLICY.reserveFraction;
  const reserveRub = directCostsRub * reserveFraction;

  const monthly = monthlyOverhead([
    { name: "ads", monthlyAmount: money(OVERHEAD_STARTING_POLICY.adsMonthlyRub), applicableShare: OVERHEAD_STARTING_POLICY.adsModularShare },
    { name: "office", monthlyAmount: money(OVERHEAD_STARTING_POLICY.officeMonthlyRub) },
    { name: "workshop-rent", monthlyAmount: money(OVERHEAD_STARTING_POLICY.workshopRentMonthlyRub) },
    { name: "electricity", monthlyAmount: money(OVERHEAD_STARTING_POLICY.electricityMonthlyRub) },
  ]);
  const annual = annualOverhead(monthly);
  const perHouse = overheadPerHouseEqualSplit(annual, OVERHEAD_STARTING_POLICY.plannedComparableHousesPerYear);
  const overheadRub = toRubles(fullOverheadPerHouse(perHouse, money(OVERHEAD_STARTING_POLICY.toolAmortizationPerHouseRub)));
  const fullCostRub = directCostsRub + reserveRub + overheadRub;

  const costSummary: CostSummary = {
    directCostsRub,
    reserveFraction,
    reserveRub,
    overheadRub,
    fullCostRub,
    knownLinesTotal: known.length,
    linesWithMissingPrice: lines.filter((l) => l.totalCostRub === null).map((l) => l.key),
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
  const step = input.totalRoundingStepRub ?? 1000;
  const { roundedTotal, roundingDelta } = applyRoundingPolicy(raw, { totalStep: money(step) });
  const evaluation = evaluatePrice(roundedTotal, money(fullCostRub), rates);

  const minimumRequiredProfit = money(input.minimumBaseProfitRub ?? 200000);
  const baseProtection = checkBaseProfitProtected(roundedTotal, money(fullCostRub), minimumRequiredProfit, rates);
  const minimumAllowedPriceRub = toRubles(priceByTargetProfit(money(fullCostRub), minimumRequiredProfit, rates));

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
    minimumAllowedPriceRub,
    baseProfitProtected: baseProtection.ok,
  };

  const byBlock = new Map<CommercialBlock, CompositionLine[]>();
  for (const l of lines) {
    if (!byBlock.has(l.block)) byBlock.set(l.block, []);
    byBlock.get(l.block)!.push(l);
  }
  const clientDescription: ClientDescriptionBlock[] = Array.from(byBlock.entries()).map(([block, blockLines]) => ({
    block,
    title: blockLabel(block),
    items: blockLines.map((l) => `${l.name}: ${l.qty} ${l.unit}`),
    priceRub: blockLines.some((l) => l.totalCostRub === null) ? null : blockLines.reduce((s, l) => s + (l.totalCostRub ?? 0), 0),
  }));

  return {
    calcEngineVersion: CALC_ENGINE_VERSION,
    houseFamily: "NORMA_FLAT_ROOF",
    templateId: "norma-77-v2",
    templateLabel: "Норма 77 V2",
    createdAt: new Date().toISOString(),
    selectedOptionIds: [],
    optionConflicts: [],
    compositionLines: lines,
    laborStages: [],
    costSummary,
    priceSummary,
    clientDescription,
    readiness: {
      level: "OWNER_APPROVED",
      // Deliberately incomplete: Приложение Б gives Норма 77 far less confirmed
      // detail than Барн 96, so this total is never a full cost.
      isFullCost: false,
      gaps: lines.filter((l) => l.totalCostRub === null).map((l) => l.name),
      assumptions: [
        "Свайное поле 6x4 - координаты из §Б3 задания.",
        "Каркас, кровля и фасад ожидают переноса рабочей сметы Норма 77.",
      ],
    },
    pileSummary: {
      totalPiles: pileCount,
      variantName: "поле 6x4",
      bindingLengthMm: bindingLengthMm(NORMA_77_GRID),
      source: "Координаты свай из §Б3 задания (Норма 77 V2)",
    },
  };
}
