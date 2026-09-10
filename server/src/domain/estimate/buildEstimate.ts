import {
  STANDARD_WINDOW_CATALOG,
  BARN108_PANORAMIC_PRODUCTS,
  exactCatalogPrice,
  estimateResizedWindowPrice,
  scaleByAnalog,
  gridPileCount,
  BARN96_KYZYL_ACROSS_BEFORE_MM,
  BARN96_KYZYL_ACROSS_AFTER_MM,
  BARN96_KYZYL_ALONG_MM,
  NORMA77_XS_MM,
  NORMA77_YS_MM,
  kotelnayaJointVariants,
  beamToPileFastenerCount,
  humanHours,
  laborCost,
  computeRemoteInstallLabor,
  reserveAmount,
  monthlyOverheadTotal,
  yearlyOverheadTotal,
  overheadPerHouse,
  fullEconomicCost,
  computePrice,
  type PricingInput,
  type WindowReferenceProduct,
} from "@lhc/calc-engine";
import { getCalculationDefaults } from "./catalogData.js";
import { BARN96_HISTORICAL_ANALOG, BARN96_SHELL_DIRECT_COST_SHARE } from "./analogBasis.js";
import type { EstimateBlock, EstimateGap, EstimateLine, EstimateResult, EstimateSelection, WindowSelectionInput } from "./types.js";

const ENGINE_VERSION = "1.0.0";

function line(partial: Omit<EstimateLine, "id">, id: string): EstimateLine {
  return { id, ...partial };
}

function blockSubtotal(lines: EstimateLine[]): number {
  return lines.reduce((acc, l) => acc + (l.amount ?? 0), 0);
}

function makeBlock(id: string, label: string, lines: EstimateLine[]): EstimateBlock {
  return { id, label, lines, subtotal: blockSubtotal(lines), hasGaps: lines.some((l) => l.amount === null) };
}

function findWindowProduct(productId: string): WindowReferenceProduct | undefined {
  return STANDARD_WINDOW_CATALOG.find((p) => p.id === productId);
}

function computeWindowLine(w: WindowSelectionInput): EstimateLine {
  const product = findWindowProduct(w.productId);
  if (!product) {
    if (w.productId in BARN108_PANORAMIC_PRODUCTS) {
      // Панорамные блоки Барн 108 считаются отдельным модулем (см. panoramaBlocks в options) —
      // здесь просто фиксируем позицию без цены, чтобы не задвоить расчёт.
      return line(
        {
          label: `${w.label} (панорамный блок Барн 108, см. блок остекления)`,
          amount: null,
          status: "included_in_package",
          costCategory: "material",
          quantity: w.qty,
          unit: "компл.",
        },
        w.id
      );
    }
    return line(
      { label: `${w.label}: неизвестный тип изделия "${w.productId}"`, amount: null, status: "needs_price", costCategory: "material" },
      w.id
    );
  }

  const sizeMatches = product.widthMm === w.widthMm && product.heightMm === w.heightMm && product.shape === w.shape;

  if (sizeMatches) {
    const unitPrice = exactCatalogPrice(product, w.targetFinish);
    return line(
      {
        label: `${w.label}: ${product.name}, ${w.targetFinish}`,
        quantity: w.qty,
        unit: "шт.",
        unitPrice: unitPrice.toNumber(),
        amount: unitPrice.times(w.qty).toNumber(),
        status: "confirmed",
        costCategory: "material",
        note: "Точная цена из подтверждённого предложения (раздел 11.3.1, приоритет 1)",
      },
      w.id
    );
  }

  const resized = estimateResizedWindowPrice({
    referenceProduct: product,
    referenceFinish: w.referenceFinish,
    targetFinish: w.targetFinish,
    newWidthMm: w.widthMm,
    newHeightMm: w.heightMm,
    newShape: w.shape,
    newHeightLeftMm: w.heightLeftMm,
    newHeightRightMm: w.heightRightMm,
  });

  return line(
    {
      label: `${w.label}: ${product.name} — изменённый размер, ${w.targetFinish}`,
      quantity: w.qty,
      unit: "шт.",
      unitPrice: resized.price.toNumber(),
      amount: resized.price.times(w.qty).toNumber(),
      status: "preliminary_by_analog",
      costCategory: "material",
      note: `Предварительная оценка по формуле раздела 11.3.2: коэффициент размера ${resized.sizeCoefficient.toFixed(4)}`,
    },
    w.id
  );
}

function buildFoundationBlock(selection: EstimateSelection, defaults: any): { block: EstimateBlock; gaps: EstimateGap[] } {
  const gaps: EstimateGap[] = [];
  const lines: EstimateLine[] = [];
  const f = selection.foundation;
  let pileCount: number;
  let pileStatus: EstimateLine["status"] = "preliminary_by_analog";

  if (f.template === "barn96_kyzyl") {
    const across = f.terraceDepthM && f.terraceDepthM !== 2 ? BARN96_KYZYL_ACROSS_AFTER_MM : BARN96_KYZYL_ACROSS_BEFORE_MM;
    pileCount = gridPileCount({ xsMm: across, ysMm: BARN96_KYZYL_ALONG_MM });
    pileStatus = "confirmed";
  } else if (f.template === "norma77") {
    pileCount = gridPileCount({ xsMm: NORMA77_XS_MM, ysMm: NORMA77_YS_MM });
    pileStatus = "confirmed";
    gaps.push({
      code: "norma77_terrace_pile_conflict",
      message: "Норма 77: боковая терраса на архитектуре ~2 м, свайное поле соответствует ~3 м — конфликт версий сохранён, не решён автоматически.",
      blocksFinal: false,
    });
  } else if (f.template === "manual") {
    pileCount = f.manualPileCount ?? 0;
    pileStatus = "confirmed";
  } else {
    const scaled = scaleByAnalog({
      analogLabel: BARN96_HISTORICAL_ANALOG.label,
      analogValue: BARN96_HISTORICAL_ANALOG.pileCount,
      analogDriverVolume: selection.closedFootprintM2,
      newDriverVolume: selection.closedFootprintM2,
    });
    pileCount = Math.ceil(scaled.scaledValue.toNumber());
    pileStatus = "preliminary_by_analog";
  }

  if (f.includeIndependentKotelnaya) {
    const variants = kotelnayaJointVariants(pileCount);
    pileCount = variants.find((v) => v.name === "independent_4_piles")!.uniquePileCount;
  }

  lines.push(
    line(
      {
        label: "Сваи (количество)",
        quantity: pileCount,
        unit: "шт.",
        amount: null,
        status: pileStatus,
        costCategory: "material",
        note: "Количество без закупочной цены сваи — цена вводится по конкретному счёту (раздел 8, Приложение А6).",
      },
      "pile_count"
    )
  );

  const fastenerCount = beamToPileFastenerCount(pileCount);
  const lagBoltPrice = defaults.fasteners?.lagBolt12x120 ?? null;
  lines.push(
    line(
      {
        label: "Глухари 12×120 (обвязка к свае, 4 шт./сваю)",
        quantity: fastenerCount,
        unit: "шт.",
        unitPrice: lagBoltPrice,
        amount: lagBoltPrice ? fastenerCount * lagBoltPrice : null,
        status: lagBoltPrice ? "confirmed" : "needs_price",
        costCategory: "material",
      },
      "beam_to_pile_fasteners"
    )
  );

  if (!lagBoltPrice) gaps.push({ code: "lag_bolt_price_missing", message: "Не задана цена глухаря 12×120.", blocksFinal: false });

  return { block: makeBlock("foundation", "Фундамент", lines), gaps };
}

export function buildEstimate(selection: EstimateSelection): EstimateResult {
  const defaults = getCalculationDefaults();
  const gaps: EstimateGap[] = [];

  // --- Блок 1: дом без внутренней отделки (оценка по аналогу Барн 96) ---
  const shellScaled = scaleByAnalog({
    analogLabel: BARN96_HISTORICAL_ANALOG.label,
    analogValue: BARN96_HISTORICAL_ANALOG.directCostsD * BARN96_SHELL_DIRECT_COST_SHARE,
    analogDriverVolume: BARN96_HISTORICAL_ANALOG.insideAreaM2,
    newDriverVolume: selection.insideAreaM2,
  });
  const shellBlock = makeBlock("shell", "Дом без внутренней отделки", [
    line(
      {
        label: `Каркас, утепление, кровля, фасад, окна/двери — оценка по аналогу (${BARN96_HISTORICAL_ANALOG.label})`,
        amount: shellScaled.scaledValue.toNumber(),
        status: "preliminary_by_analog",
        costCategory: "material",
        note: shellScaled.basis + ". Требует уточнения по рабочим чертежам для перехода в подтверждённый статус (раздел 7.5).",
      },
      "shell_analog"
    ),
  ]);
  gaps.push({
    code: "shell_bom_not_from_drawings",
    message: "Состав каркаса/кровли/фасада рассчитан по аналогу площади, не по рабочим чертежам этой планировки.",
    blocksFinal: false,
  });

  // --- Блок 2: окна (точный расчёт) ---
  const windowLines = selection.windows.map(computeWindowLine);
  const windowsBlock = makeBlock("windows", "Остекление", windowLines);

  // --- Блок 3: фундамент ---
  const { block: foundationBlock, gaps: foundationGaps } = buildFoundationBlock(selection, defaults);
  gaps.push(...foundationGaps);

  // --- Блок 4: опции (отделка/инженерия/сантехника и т.д.) ---
  const optionLines = selection.options.map((o) =>
    line(
      {
        label: o.label,
        amount: o.priceRub ?? null,
        status: o.priceRub != null ? o.status : "needs_price",
        costCategory: "material",
        note: o.note,
      },
      o.id
    )
  );
  for (const o of selection.options) {
    if (o.priceRub == null) gaps.push({ code: `option_price_missing_${o.id}`, message: `Не задана цена опции "${o.label}".`, blocksFinal: false });
  }
  const optionsBlock = makeBlock("addons", "Дополнительные опции и внутренняя отделка", optionLines);

  // --- Блок 5: труд (оценка по аналогу) ---
  const laborScaled = scaleByAnalog({
    analogLabel: BARN96_HISTORICAL_ANALOG.label,
    analogValue: BARN96_HISTORICAL_ANALOG.laborHumanHours,
    analogDriverVolume: BARN96_HISTORICAL_ANALOG.insideAreaM2,
    newDriverVolume: selection.insideAreaM2,
  });
  const laborRate = defaults.labor?.productionInstallRatePerHour ?? 550;
  const laborCostScaled = laborCost(laborScaled.scaledValue, laborRate);
  const laborLines: EstimateLine[] = [
    line(
      {
        label: `Производство/монтаж — человеко-часы по аналогу (${laborScaled.scaledValue.toFixed(1)} ч × ${laborRate} ₽)`,
        amount: laborCostScaled.toNumber(),
        status: "preliminary_by_analog",
        costCategory: "labor",
        note: laborScaled.basis,
      },
      "labor_analog"
    ),
  ];

  if (selection.installDistanceKm && selection.installDaysOverride) {
    const remote = computeRemoteInstallLabor({
      people: 4,
      days: selection.installDaysOverride,
      hoursPerDay: 10,
      ratePerHour: laborRate,
      allowancePerPersonPerDay: defaults.labor?.siteAllowancePerPersonPerDay ?? 1000,
    });
    laborLines.push(
      line(
        {
          label: `Удалённый монтаж (${selection.installDistanceKm} км, ${selection.installDaysOverride} дн.)`,
          amount: remote.totalLaborCost.toNumber(),
          status: "confirmed",
          costCategory: "labor",
          note: "Раздел 16.1: труд считается отдельно, материалы/доставка модулей/фундамент не умножаются на срок.",
        },
        "remote_install_labor"
      )
    );
  }
  const laborBlock = makeBlock("labor", "Труд", laborLines);

  // --- Прямые затраты D ---
  const D = shellBlock.subtotal + windowsBlock.subtotal + foundationBlock.subtotal + optionsBlock.subtotal + laborBlock.subtotal;

  // --- Резерв, накладные, амортизация ---
  const R = reserveAmount(D, defaults.reserve?.defaultPctOfDirectCosts ?? 5).toNumber();
  const overheadCfg = defaults.overhead ?? {};
  const yearly = yearlyOverheadTotal({
    adsMonthly: overheadCfg.adsMonthly ?? 200000,
    adsShareForModularHouses: overheadCfg.adsShareForModularHouses ?? 0.65,
    officeMonthly: overheadCfg.officeMonthly ?? 40000,
    workshopRentMonthly: overheadCfg.workshopRentMonthly ?? 350000,
    workshopElectricityMonthly: overheadCfg.workshopElectricityMonthly ?? 40000,
  });
  const O = overheadPerHouse(yearly, overheadCfg.plannedHousesPerYear ?? 20).toNumber();
  const A = overheadCfg.toolAmortizationPerHouse ?? 70000;

  const C = fullEconomicCost(D, R, O, A).toNumber();

  const overheadBlock = makeBlock("overhead", "Резерв и накладные", [
    line({ label: "Резерв (5% от прямых затрат)", amount: R, status: "preliminary_by_analog", costCategory: "reserve", note: "Предложенная ставка, не утверждённая владельцем (раздел 17)." }, "reserve"),
    line({ label: "Распределённые накладные на дом", amount: O, status: "confirmed", costCategory: "overhead" }, "overhead_per_house"),
    line({ label: "Амортизация инструмента на дом", amount: A, status: "confirmed", costCategory: "overhead" }, "amortization"),
  ]);

  // --- Цена продажи ---
  const pricingInput: PricingInput =
    selection.pricing.mode === "markup"
      ? { mode: "markup", fullCostC: C, markupK: selection.pricing.markupK ?? 0.3, taxRateT: selection.pricing.taxRateT, managerCommissionM: selection.pricing.managerCommissionM }
      : selection.pricing.mode === "target_profit_absolute"
      ? {
          mode: "target_profit_absolute",
          fullCostC: C,
          targetProfitG: selection.pricing.targetProfitG ?? 0,
          taxRateT: selection.pricing.taxRateT,
          managerCommissionM: selection.pricing.managerCommissionM,
        }
      : {
          mode: "target_profit_share",
          fullCostC: C,
          targetShareG: selection.pricing.targetShareG ?? 0.15,
          taxRateT: selection.pricing.taxRateT,
          managerCommissionM: selection.pricing.managerCommissionM,
        };

  const priced = computePrice(pricingInput, selection.pricing.roundingStep);

  const blocks: EstimateBlock[] = [shellBlock, windowsBlock, foundationBlock, optionsBlock, laborBlock, overheadBlock];

  return {
    blocks,
    directCostsD: D,
    reserveR: R,
    overheadO: O,
    amortizationA: A,
    fullCostC: C,
    pricing: {
      priceBeforeRounding: priced.priceBeforeRounding.toNumber(),
      price: priced.price.toNumber(),
      tax: priced.tax.toNumber(),
      commission: priced.commission.toNumber(),
      profit: priced.profit.toNumber(),
      markupPct: priced.markup.times(100).toNumber(),
      marginAfterCostsPct: priced.marginAfterCosts.times(100).toNumber(),
    },
    gaps,
    engineVersion: ENGINE_VERSION,
  };
}
