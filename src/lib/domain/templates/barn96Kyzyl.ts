import { money, round, toRubles } from "../../calc/money";
import { gridPileCount, shiftEdgeRow, bindingLengthMm, PILE_FASTENING_NORMS, PileGrid } from "../../calc/piles";
import { laborHours, laborCost, travelSurcharge, summarizeBrigadeStages } from "../../calc/labor";
import { monthlyOverhead, annualOverhead, overheadPerHouseEqualSplit, fullOverheadPerHouse } from "../../calc/overhead";
import {
  priceByMarkup,
  priceByTargetProfit,
  priceByTargetProfitShare,
  evaluatePrice,
  applyRoundingPolicy,
  checkBaseProfitProtected,
} from "../../calc/pricing";
import { applyOptions, OptionDefinition, OwnedLine } from "../../calc/options";
import { packLoopsIntoCoils, pipeLengthForZoneM } from "../../calc/floorHeating";
import { OVERHEAD_STARTING_POLICY, PRICING_STARTING_POLICY, REFERENCE_PRICES } from "../referenceData";
import {
  CALC_ENGINE_VERSION,
  ClientDescriptionBlock,
  COMMERCIAL_BLOCK_LABELS,
  CommercialBlock,
  CompositionLine,
  CostSummary,
  EstimateSnapshot,
  formatQty,
  LaborStageSummary,
  PriceSummary,
  PricingMode,
} from "../snapshot";

export interface Barn96KyzylInput {
  terraceDepthM: 2 | 3;
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

const HEATED_AREA_M2 = 61.23; // §Б1: internal heated area of Барн 96 / Кызыл
const TERRACE_AREA_M2 = 22.74;

function pileGridFor(terraceDepthM: 2 | 3): PileGrid {
  const before: PileGrid = {
    xCoordsMm: [0, 1900, 4900, 7900, 10800],
    yCoordsMm: [0, 1867, 3733, 5600, 7800],
  };
  if (terraceDepthM === 2) return before;
  return { xCoordsMm: shiftEdgeRow(before.xCoordsMm, 0, 1000), yCoordsMm: before.yCoordsMm };
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

function buildOptionDefs(): Record<string, OptionDefinition> {
  const pipeLengthM = pipeLengthForZoneM(HEATED_AREA_M2, REFERENCE_PRICES.warmFloorPipeNormPerM2);
  const loopLimitM = 60;
  const loopCount = Math.ceil(pipeLengthM / loopLimitM);
  const loopLengths = Array.from({ length: loopCount }, (_, i) =>
    i < loopCount - 1 ? loopLimitM : pipeLengthM - loopLimitM * (loopCount - 1),
  );
  const coilPack = packLoopsIntoCoils(loopLengths, 200);

  return {
    "warm-floor": {
      id: "warm-floor",
      actions: [
        {
          type: "REPLACE",
          key: "interior:floor:finish",
          line: { material: "Пол под тёплый: OSB один верхний слой", qty: HEATED_AREA_M2, unit: "m2" },
        },
        {
          type: "ADD",
          key: "interior:floor:warm-pipe-consumed",
          line: {
            material: "Труба тёплого пола PEX (расход, включено в закупку бухт)",
            qty: Math.round(pipeLengthM * 100) / 100,
            unit: "m",
          },
        },
        {
          type: "ADD",
          key: "interior:floor:warm-coils",
          line: { material: "Бухты трубы тёплого пола, 200 м", qty: coilPack.coilsUsed, unit: "шт" },
        },
        {
          type: "ADD",
          key: "interior:floor:screed",
          line: { material: "Стяжка тёплого пола с работой", qty: HEATED_AREA_M2, unit: "m2" },
        },
        {
          type: "ADD",
          key: "interior:floor:warm-film",
          line: { material: "Плёнка полиэтиленовая под стяжку", qty: HEATED_AREA_M2, unit: "m2" },
        },
        {
          type: "ADD",
          key: "interior:floor:warm-mesh",
          line: { material: "Сетка 4мм 150x150 под стяжку", qty: HEATED_AREA_M2, unit: "m2" },
        },
      ],
    },
    convectors: {
      id: "convectors",
      actions: [
        {
          type: "ADD",
          key: "interior:heating:convectors",
          line: { material: "Чёрный конвектор", qty: 6, unit: "шт" },
        },
      ],
    },
    "tile-bathroom": {
      id: "tile-bathroom",
      actions: [
        {
          type: "ADD",
          key: "interior:bathroom:tile-shower",
          line: { material: "Плитка душевой зоны (пол + 2 стены 2.5м)", qty: 6, unit: "m2" },
        },
        {
          type: "ADD",
          key: "interior:bathroom:tile-base",
          line: { material: "Основание плитки (комплекс ГВЛ/гидроизоляция/клей/работа)", qty: 6, unit: "m2" },
        },
      ],
    },
    "boiler-room": {
      id: "boiler-room",
      actions: [
        {
          type: "ADD",
          key: "foundation:boiler-room:piles",
          line: { material: "Независимые сваи пристройки-кочегарки (4 шт)", qty: 4, unit: "шт" },
        },
        {
          type: "ADD",
          key: "options:boiler-room:kit",
          line: { material: "Пристройка-кочегарка 3x3 м (типовой комплект)", qty: 1, unit: "компл" },
        },
      ],
    },
  };
}

const OSB_12MM_PER_M2_RUB = 1120 / (1.25 * 2.5);

const UNIT_PRICE_LOOKUP: Record<string, number | null> = {
  "Черновой пол OSB 12мм (без тёплого пола)": OSB_12MM_PER_M2_RUB,
  "Пол под тёплый: OSB один верхний слой": OSB_12MM_PER_M2_RUB,
  "Труба тёплого пола PEX (расход, включено в закупку бухт)": null, // informational only, see coils line
  "Бухты трубы тёплого пола, 200 м": 200 * REFERENCE_PRICES.warmFloorPipePricePerMRub,
  "Стяжка тёплого пола с работой": REFERENCE_PRICES.warmFloorScreedPerM2Rub,
  "Плёнка полиэтиленовая под стяжку": REFERENCE_PRICES.warmFloorFilmPerM2Rub,
  "Сетка 4мм 150x150 под стяжку": REFERENCE_PRICES.warmFloorMeshPerM2Rub,
  "Чёрный конвектор": REFERENCE_PRICES.blackConvectorRub,
  "Плитка душевой зоны (пол + 2 стены 2.5м)": REFERENCE_PRICES.tilePerM2Rub,
  "Основание плитки (комплекс ГВЛ/гидроизоляция/клей/работа)": REFERENCE_PRICES.tileBasePackagePerM2Rub,
  "Независимые сваи пристройки-кочегарки (4 шт)": null, // §8: pile prices come from the supplier invoice, not a fixed catalogue
  "Пристройка-кочегарка 3x3 м (типовой комплект)": null, // price not yet confirmed by owner
};

const STATUS_FOR_MATERIAL: Record<string, CompositionLine["status"]> = {
  "Труба тёплого пола PEX (расход, включено в закупку бухт)": "INCLUDED_IN_PACKAGE",
  "Независимые сваи пристройки-кочегарки (4 шт)": "PRICE_NEEDED",
  "Пристройка-кочегарка 3x3 м (типовой комплект)": "PRICE_NEEDED",
};

function ownedLinesToCompositionLines(lines: OwnedLine[]): CompositionLine[] {
  return lines.map((l) => {
    const unitCost = UNIT_PRICE_LOOKUP[l.line.material] ?? null;
    const totalCost = unitCost === null ? null : unitCost * l.line.qty;
    return {
      key: l.key,
      block: blockFromKey(l.key),
      category: "MATERIAL",
      name: l.line.material,
      qty: l.line.qty,
      unit: l.line.unit,
      unitCostRub: unitCost,
      totalCostRub: totalCost,
      status: STATUS_FOR_MATERIAL[l.line.material] ?? (unitCost === null ? "PRICE_NEEDED" : "CONFIRMED"),
      source: l.ownerOptionId === "BASE" ? "Базовая комплектация" : `Опция: ${l.ownerOptionId}`,
      formulaExplanation: `${l.line.qty} ${l.line.unit} x ${unitCost ?? "цена не задана"} ₽`,
      ownerOptionId: l.ownerOptionId,
    };
  });
}

function fixedLines(grid: PileGrid, targetDirectCostRub = 4883473.03): { lines: CompositionLine[]; laborStages: LaborStageSummary[] } {
  const pileCount = gridPileCount(grid);
  const rate = money(REFERENCE_PRICES.laborRatePerHourRub);

  const stages = summarizeBrigadeStages([
    { name: "Каркас", people: 4, days: 7, hoursPerDay: 10 },
    { name: "Фасад/терраса", people: 4, days: 8, hoursPerDay: 10 },
    { name: "Внутренняя отделка", people: 4, days: 17, hoursPerDay: 10 },
    { name: "Доделки", people: 4, days: 7, hoursPerDay: 10 },
  ]);
  const laborStages: LaborStageSummary[] = stages.stages.map((s) => ({
    name: s.name,
    people: s.people,
    days: s.days,
    hoursPerDay: s.hoursPerDay,
    hours: s.hours,
    ratePerHourRub: REFERENCE_PRICES.laborRatePerHourRub,
    costRub: toRubles(laborCost(s.hours, rate)),
  }));

  const doborHours = laborHours(1, 1.5, 10);
  const doborCost = toRubles(laborCost(doborHours, rate));
  const travelDays = stages.totalBrigadeDays; // 39
  const travelCost = toRubles(travelSurcharge(4, travelDays, money(REFERENCE_PRICES.travelSurchargePerPersonDayRub)));

  const boltsCount = pileCount * PILE_FASTENING_NORMS.bindingToPileBoltsPerPile;
  const bindingCost = boltsCount * REFERENCE_PRICES.pileFasteningBoltRub;

  const mainLaborCost = toRubles(laborCost(stages.totalHours, rate));
  // The base floor-finish line (present whether or not warm-floor is selected) is
  // priced independently by the options engine - it must be netted out of the
  // historical remainder too, or its cost would be counted twice.
  const baseFloorFinishCost = HEATED_AREA_M2 * OSB_12MM_PER_M2_RUB;

  const knownSum = bindingCost + mainLaborCost + doborCost + travelCost + baseFloorFinishCost;
  const remainder = Math.max(0, targetDirectCostRub - knownSum);

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
      source: "Шаблон Барн 96 / Кызыл, поле 5x5",
      formulaExplanation: `${grid.xCoordsMm.length} x ${grid.yCoordsMm.length} = ${pileCount} свай; цена импортируется из счёта поставщика`,
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
      formulaExplanation: `${pileCount} свай x ${PILE_FASTENING_NORMS.bindingToPileBoltsPerPile} = ${boltsCount} шт x ${REFERENCE_PRICES.pileFasteningBoltRub} ₽`,
      ownerOptionId: "BASE",
    },
    {
      key: "installation:labor:main-brigade",
      block: "INSTALLATION",
      category: "LABOR",
      name: "Бригада: каркас, фасад/терраса, отделка, доделки",
      qty: stages.totalHours,
      unit: "чел-час",
      unitCostRub: REFERENCE_PRICES.laborRatePerHourRub,
      totalCostRub: mainLaborCost,
      status: "CONFIRMED",
      source: "Историческая калибровка Барн 96 §16",
      formulaExplanation: `4 x (7+8+17+7) дней x 10ч = ${stages.totalHours} чел-час x 550 ₽`,
      ownerOptionId: "BASE",
    },
    {
      key: "shell:labor:dobor-bending",
      block: "SHELL",
      category: "LABOR",
      name: "Гибка доборов",
      qty: doborHours,
      unit: "чел-час",
      unitCostRub: REFERENCE_PRICES.laborRatePerHourRub,
      totalCostRub: doborCost,
      status: "CONFIRMED",
      source: "§16",
      formulaExplanation: "1 x 1.5 дня x 10ч = 15 чел-час x 550 ₽",
      ownerOptionId: "BASE",
    },
    {
      key: "installation:labor:travel-surcharge",
      block: "INSTALLATION",
      category: "LABOR",
      name: "Выездная доплата бригады",
      qty: travelDays,
      unit: "выездной день",
      unitCostRub: 4 * REFERENCE_PRICES.travelSurchargePerPersonDayRub,
      totalCostRub: travelCost,
      status: "CONFIRMED",
      source: "§16",
      formulaExplanation: `4 чел x ${travelDays} дней x 1000 ₽`,
      ownerOptionId: "BASE",
    },
    {
      key: "shell:materials:historical-remainder",
      block: "SHELL",
      category: "MATERIAL",
      name: "Прочие материалы и работы по рабочей смете Барн 93 (детализация ожидает переноса полной сметы)",
      qty: 1,
      unit: "компл",
      unitCostRub: remainder,
      totalCostRub: remainder,
      status: "PRELIMINARY_BY_ANALOGY",
      source: "§Б1 историческая смета Барн 93",
      formulaExplanation: "Остаток прямых затрат до подтверждённого исторического D = 4 883 473,03 ₽",
      ownerOptionId: "BASE",
    },
  ];

  return { lines, laborStages };
}

function costSummaryFromLines(lines: CompositionLine[], reserveFraction: number): CostSummary {
  const known = lines.filter((l) => l.totalCostRub !== null);
  const directCostsRub = known.reduce((s, l) => s + (l.totalCostRub ?? 0), 0);
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

  return {
    directCostsRub,
    reserveFraction,
    reserveRub,
    overheadRub,
    fullCostRub,
    knownLinesTotal: known.length,
    linesWithMissingPrice: lines.filter((l) => l.totalCostRub === null).map((l) => l.key),
  };
}

function computePrice(
  fullCostRub: number,
  input: Barn96KyzylInput,
  rates: { taxFraction: number; commissionFraction: number },
): { rawPriceRub: number; roundedPriceRub: number; roundingDeltaRub: number; mode: PricingMode } {
  const mode = input.pricingMode ?? "TARGET_PROFIT_RUB";
  let raw;
  if (mode === "MARKUP") {
    raw = priceByMarkup(money(fullCostRub), input.markupFraction ?? 0.3);
  } else if (mode === "TARGET_PROFIT_SHARE") {
    raw = priceByTargetProfitShare(money(fullCostRub), input.targetProfitShare ?? 0.2, rates);
  } else {
    raw = priceByTargetProfit(money(fullCostRub), money(input.targetProfitRub ?? 2102353.32), rates);
  }
  const step = input.totalRoundingStepRub ?? 1;
  // Round off floating-point noise from the plain-number cost summary before
  // applying the (integer-sensitive) rounding-step policy.
  const { roundedTotal, roundingDelta } = applyRoundingPolicy(round(raw, 2), { totalStep: money(step) });
  return {
    rawPriceRub: toRubles(raw),
    roundedPriceRub: toRubles(roundedTotal),
    roundingDeltaRub: toRubles(roundingDelta),
    mode,
  };
}

export function buildBarn96KyzylSnapshot(input: Barn96KyzylInput): EstimateSnapshot {
  const rates = {
    taxFraction: input.taxFraction ?? PRICING_STARTING_POLICY.taxFraction,
    commissionFraction: input.commissionFraction ?? PRICING_STARTING_POLICY.commissionFraction,
  };
  const grid = pileGridFor(input.terraceDepthM);
  const pileCount = gridPileCount(grid);

  const optionDefs = buildOptionDefs();
  const baseOwnedLines: OwnedLine[] = [
    {
      key: "interior:floor:finish",
      ownerOptionId: "BASE",
      line: { material: "Черновой пол OSB 12мм (без тёплого пола)", qty: HEATED_AREA_M2, unit: "m2" },
    },
  ];

  const { lines: optionLines, conflicts } = applyOptions(baseOwnedLines, input.selectedOptionIds, optionDefs);
  const optionCompositionLines = ownedLinesToCompositionLines(optionLines);

  const { lines: fixed, laborStages } = fixedLines(grid);
  const allLines = [...fixed, ...optionCompositionLines];

  const reserveFraction = PRICING_STARTING_POLICY.reserveFraction;
  const costSummary = costSummaryFromLines(allLines, reserveFraction);
  const priced = computePrice(costSummary.fullCostRub, input, rates);
  const evaluation = evaluatePrice(money(priced.roundedPriceRub), money(costSummary.fullCostRub), rates);

  // Base-configuration profit protection: recompute with every option OFF, same pricing policy.
  const baseOnlyLines = [...fixed, ...ownedLinesToCompositionLines(applyOptions(baseOwnedLines, [], optionDefs).lines)];
  const baseOnlyCost = costSummaryFromLines(baseOnlyLines, reserveFraction);
  const minimumRequiredProfit = money(input.minimumBaseProfitRub ?? 500000);
  const basePriced = computePrice(baseOnlyCost.fullCostRub, input, rates);
  const baseProtection = checkBaseProfitProtected(
    money(basePriced.roundedPriceRub),
    money(baseOnlyCost.fullCostRub),
    minimumRequiredProfit,
    rates,
  );
  const minimumAllowedPriceRub = toRubles(
    priceByTargetProfit(money(costSummary.fullCostRub), minimumRequiredProfit, rates),
  );

  const priceSummary: PriceSummary = {
    mode: priced.mode,
    rawPriceRub: priced.rawPriceRub,
    roundedPriceRub: priced.roundedPriceRub,
    roundingDeltaRub: priced.roundingDeltaRub,
    taxRub: toRubles(evaluation.tax),
    commissionRub: toRubles(evaluation.commission),
    profitRub: toRubles(evaluation.profit),
    markup: evaluation.markup,
    marginAfterTaxCommission: evaluation.marginAfterTaxCommission,
    minimumAllowedPriceRub,
    baseProfitProtected: baseProtection.ok,
  };

  const clientDescription = buildClientDescription(allLines);

  // Base direct costs reconcile to the confirmed historical estimate, so only
  // an ADDED option that still has no price leaves the total incomplete.
  const optionGapNames = allLines
    .filter((l) => l.ownerOptionId !== "BASE" && l.totalCostRub === null && l.status !== "INCLUDED_IN_PACKAGE")
    .map((l) => l.name);

  return {
    calcEngineVersion: CALC_ENGINE_VERSION,
    houseFamily: "BARN",
    templateId: "barn-96-kyzyl",
    templateLabel: "Барн 96 / Кызыл",
    createdAt: new Date().toISOString(),
    selectedOptionIds: Array.from(new Set(input.selectedOptionIds)),
    optionConflicts: conflicts,
    compositionLines: allLines,
    laborStages,
    costSummary,
    priceSummary,
    clientDescription,
    readiness: {
      level: "OWNER_APPROVED",
      isFullCost: optionGapNames.length === 0,
      gaps: optionGapNames,
      assumptions: [
        "Прямые затраты сведены к подтверждённому историческому итогу рабочей сметы Барн 93; построчная детализация части материалов ожидает переноса полной сметы.",
        "Свайное поле - подтверждённый шаблон 5x5 из раздела 8 задания, а не вывод из площади.",
      ],
    },
    pileSummary: {
      totalPiles: pileCount,
      variantName: input.terraceDepthM === 2 ? "терраса 2м" : "терраса 3м",
      bindingLengthMm: bindingLengthMm(grid),
      source: "Подтверждённый шаблон Барн 96 / Кызыл, поле 5x5",
    },
  };
}

function buildClientDescription(lines: CompositionLine[]): ClientDescriptionBlock[] {
  const byBlock = new Map<CommercialBlock, CompositionLine[]>();
  for (const l of lines) {
    if (l.status === "NOT_IN_ORDER") continue;
    if (!byBlock.has(l.block)) byBlock.set(l.block, []);
    byBlock.get(l.block)!.push(l);
  }
  return Array.from(byBlock.entries()).map(([block, blockLines]) => ({
    block,
    title: COMMERCIAL_BLOCK_LABELS[block],
    items: blockLines.map((l) => `${l.name}: ${formatQty(l.qty, l.unit)}`),
    priceRub: blockLines.some((l) => l.totalCostRub === null)
      ? null
      : blockLines.reduce((s, l) => s + (l.totalCostRub ?? 0), 0),
  }));
}
