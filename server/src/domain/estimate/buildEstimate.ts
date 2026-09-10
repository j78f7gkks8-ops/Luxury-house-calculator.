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
  productAreaM2,
  footprintAreaM2,
  wallPerimeterM,
  grossWallAreaM2,
  barnGableRoofAreaM2,
  netWallAreaM2,
  insulationVolumeM3,
  areaWithReserve,
  type PricingInput,
  type WindowReferenceProduct,
  type RectFootprint,
} from "@lhc/calc-engine";
import { getCalculationDefaults } from "./catalogData.js";
import { BARN96_HISTORICAL_ANALOG, BARN96_FRAMING_ONLY_SHARE } from "./analogBasis.js";
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

function totalWindowOpeningAreaM2(windows: WindowSelectionInput[]): number {
  return windows.reduce((acc, w) => {
    const area = productAreaM2({
      shape: w.shape,
      widthMm: w.widthMm,
      heightMm: w.heightMm,
      heightLeftMm: w.heightLeftMm,
      heightRightMm: w.heightRightMm,
    });
    return acc + area.times(w.qty).toNumber();
  }, 0);
}

/**
 * Раздел 7.4/7.5: если у планировки есть прямоугольный закрытый контур (rectFootprint),
 * стены/кровля/утепление/облицовка/плёнки считаются по реальной геометрии и ценам за
 * единицу, а не одним коэффициентом ₽/м² (раздел 7.1: "нельзя хранить весь дом одним
 * коэффициентом"). Проёмы вычитаются из площади стены (раздел 11.5.1) до расчёта облицовки
 * и утеплителя. Каркас/крепёж/работы по сборке коробки остаются оценкой по аналогу — для них
 * нет ни рабочего чертежа, ни нормы на узел (раздел 7.5, уровень 3).
 */
function buildShellBlock(
  selection: EstimateSelection,
  defaults: any,
  windowsOpeningAreaM2: number
): { block: EstimateBlock; gaps: EstimateGap[] } {
  const gaps: EstimateGap[] = [];
  const lines: EstimateLine[] = [];
  const footprint = selection.rectFootprint;

  const framingScaled = scaleByAnalog({
    analogLabel: BARN96_HISTORICAL_ANALOG.label,
    analogValue: BARN96_HISTORICAL_ANALOG.directCostsD * BARN96_FRAMING_ONLY_SHARE,
    analogDriverVolume: BARN96_HISTORICAL_ANALOG.insideAreaM2,
    newDriverVolume: selection.insideAreaM2,
  });
  lines.push(
    line(
      {
        label: `Каркас, крепёж и сборка коробки — оценка по аналогу (${BARN96_HISTORICAL_ANALOG.label})`,
        amount: framingScaled.scaledValue.toNumber(),
        status: "preliminary_by_analog",
        costCategory: "material",
        note: framingScaled.basis + ". Требует рабочих чертежей для перехода в подтверждённый статус (раздел 7.5).",
      },
      "shell_framing_analog"
    )
  );

  if (!footprint) {
    gaps.push({
      code: "shell_geometry_not_rectangular",
      message: "Закрытый контур не прямоугольный (или геометрия не задана) — площадь стен/кровли не может быть посчитана напрямую; используется только оценка каркаса по аналогу.",
      blocksFinal: false,
    });
    return { block: makeBlock("shell", "Дом без внутренней отделки", lines), gaps };
  }

  const rect: RectFootprint = { spanM: footprint.spanM, lengthM: footprint.lengthM };
  const profile = defaults.structuralProfiles?.[selection.family] ?? {};
  const facade = defaults.facade ?? {};
  const insulationCfg = defaults.insulation ?? {};
  const filmsCfg = defaults.films ?? {};

  const wallHeightM: number | null = profile.wallHeightM ?? (profile.cleanCeilingHeightMm != null ? profile.cleanCeilingHeightMm / 1000 : null);

  if (wallHeightM == null) {
    lines.push(
      line(
        {
          label: "Площадь стен и зависимые материалы (утепление/облицовка/плёнка А)",
          amount: null,
          status: "needs_size",
          costCategory: "material",
          quantity: null,
          note: `Высота стены семейства ${selection.family} не задана владельцем (needs_size) — раздел 7.3.`,
        },
        "wall_area_blocked"
      )
    );
    gaps.push({ code: "wall_height_missing", message: `Высота стены семейства ${selection.family} не задана.`, blocksFinal: false });
  } else {
    const grossWallM2 = grossWallAreaM2(rect, wallHeightM);
    const netWallM2 = netWallAreaM2(grossWallM2, windowsOpeningAreaM2);

    lines.push(
      line(
        {
          label: "Площадь стен нетто (за вычетом проёмов)",
          quantity: Number(netWallM2.toFixed(2)),
          unit: "м²",
          amount: null,
          status: "preliminary_by_analog",
          costCategory: "material",
          note: `Периметр ${wallPerimeterM(rect).toFixed(2)} м × высота ${wallHeightM.toFixed(2)} м − проёмы ${windowsOpeningAreaM2.toFixed(2)} м². Источник высоты: ${profile.wallHeightSource ?? profile.cleanCeilingHeightSource ?? "неизвестно"}.`,
        },
        "wall_area_net"
      )
    );

    const planken = facade.planken20x120x3000;
    if (planken?.pricePerM2) {
      lines.push(
        line(
          {
            label: "Наружная облицовка планкеном",
            quantity: Number(netWallM2.toFixed(2)),
            unit: "м²",
            unitPrice: planken.pricePerM2,
            amount: netWallM2.times(planken.pricePerM2).toNumber(),
            status: "preliminary_by_analog",
            costCategory: "material",
            note: "Раздел 11: базовая технология — планкен по всему фасаду; выбор комбинированного фасада меняет эту строку.",
          },
          "facade_planken"
        )
      );
    }

    const wallInsulationM3 = insulationVolumeM3(netWallM2, profile.wallInsulationMm ?? 150);
    const floorInsulationM3 = insulationVolumeM3(footprintAreaM2(rect), profile.floorInsulationMm ?? 200);
    const totalInsulationM3 = wallInsulationM3.plus(floorInsulationM3);
    if (insulationCfg.knaufPricePerM3) {
      lines.push(
        line(
          {
            label: "Утеплитель Knauf (стены + пол)",
            quantity: Number(totalInsulationM3.toFixed(3)),
            unit: "м³",
            unitPrice: insulationCfg.knaufPricePerM3,
            amount: totalInsulationM3.times(insulationCfg.knaufPricePerM3).toNumber(),
            status: "preliminary_by_analog",
            costCategory: "material",
            note: `Стены: ${wallInsulationM3.toFixed(2)} м³ по ${profile.wallInsulationMm ?? 150} мм; пол: ${floorInsulationM3.toFixed(2)} м³ по ${profile.floorInsulationMm ?? 200} мм. Без учёта раскладки плит и обрезков (раздел 10).`,
          },
          "insulation_wall_floor"
        )
      );
    }

    const izospanA = filmsCfg.izospanA;
    if (izospanA?.pricePerM2) {
      const areaWithReserveM2 = areaWithReserve(netWallM2, filmsCfg.generalReservePct ?? 10);
      lines.push(
        line(
          {
            label: "Изоспан А (наружная сторона стен, с запасом)",
            quantity: Number(areaWithReserveM2.toFixed(2)),
            unit: "м²",
            unitPrice: izospanA.pricePerM2,
            amount: areaWithReserveM2.times(izospanA.pricePerM2).toNumber(),
            status: "preliminary_by_analog",
            costCategory: "material",
            note: `Запас ${filmsCfg.generalReservePct ?? 10}% применён один раз (раздел 10/23 п.9).`,
          },
          "izospan_a_walls"
        )
      );
    }

    if (selection.family === "BARN") {
      const angleDeg = profile.roofAngleDeg ?? 9;
      const overhangM = profile.roofOverhangM ?? 0.3;
      const roof = barnGableRoofAreaM2(rect, angleDeg, overhangM);
      lines.push(
        line(
          {
            label: `Кровля — двускатная ${angleDeg}° (два ската)`,
            quantity: Number(roof.totalAreaM2.toFixed(2)),
            unit: "м²",
            amount: null,
            status: "preliminary_by_analog",
            costCategory: "material",
            note: `Подъём конька ${roof.ridgeRiseM.toFixed(4)} м, свес ${overhangM} м (${profile.roofOverhangSource ?? "needs_price"}). Раздел 7.2.`,
          },
          "roof_area"
        )
      );
      const roofing = facade.roofingC21;
      if (roofing?.pricePerM2) {
        lines.push(
          line(
            {
              label: "Профлист С21 кровли",
              quantity: Number(roof.totalAreaM2.toFixed(2)),
              unit: "м²",
              unitPrice: roofing.pricePerM2,
              amount: roof.totalAreaM2.times(roofing.pricePerM2).toNumber(),
              status: "preliminary_by_analog",
              costCategory: "material",
            },
            "roofing_sheet"
          )
        );
      }
      const izospanAM = filmsCfg.izospanAM;
      if (izospanAM?.pricePerM2) {
        const roofFilmAreaWithReserve = areaWithReserve(roof.totalAreaM2, filmsCfg.generalReservePct ?? 10);
        lines.push(
          line(
            {
              label: "Изоспан АМ (сверху кровли, с запасом)",
              quantity: Number(roofFilmAreaWithReserve.toFixed(2)),
              unit: "м²",
              unitPrice: izospanAM.pricePerM2,
              amount: roofFilmAreaWithReserve.times(izospanAM.pricePerM2).toNumber(),
              status: "preliminary_by_analog",
              costCategory: "material",
            },
            "izospan_am_roof"
          )
        );
      }
    } else {
      const angleDeg = profile.roofAngleDeg;
      if (angleDeg == null) {
        lines.push(
          line(
            {
              label: "Кровля Нормы (уклон не задан владельцем)",
              amount: null,
              status: "needs_price",
              costCategory: "material",
              note: profile.roofAngleNote ?? "Раздел 7.3: угол — параметр конкретного профиля, не подставляется автоматически.",
            },
            "roof_area_norma_blocked"
          )
        );
        gaps.push({ code: "norma_roof_angle_missing", message: "Угол кровли Нормы не задан владельцем.", blocksFinal: false });
      }
    }
  }

  return { block: makeBlock("shell", "Дом без внутренней отделки", lines), gaps };
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

  // --- Блок 2: окна (точный расчёт) — считаем первым, чтобы вычесть проёмы из стен ---
  const windowLines = selection.windows.map(computeWindowLine);
  const windowsBlock = makeBlock("windows", "Остекление", windowLines);
  const windowsOpeningAreaM2 = totalWindowOpeningAreaM2(selection.windows);

  // --- Блок 1: дом без внутренней отделки — реальная геометрия, где есть rectFootprint ---
  const { block: shellBlock, gaps: shellGaps } = buildShellBlock(selection, defaults, windowsOpeningAreaM2);
  gaps.push(...shellGaps);

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
