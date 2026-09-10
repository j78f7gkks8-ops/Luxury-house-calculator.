import { describe, it, expect } from "vitest";
import { humanHours, laborCost, siteAllowance } from "../src/labor.js";
import { computeRemoteInstallLabor } from "../src/remote-install.js";
import { monthlyOverheadTotal, yearlyOverheadTotal, overheadPerHouse, fullOverheadPerHouseWithAmortization } from "../src/overhead.js";
import { computePrice, profitFromPrice, checkBaseProtection } from "../src/pricing.js";
import { applyEffect, applyEffects, emptyState, retractOption } from "../src/options-engine.js";
import { areaWithReserve, rollsFractional, rollsWhole, wholeRollSurplusM2 } from "../src/films.js";
import { totalGu10LampsWithReserve } from "../src/lighting.js";
import { tiledZoneAreaM2, ceilingCanvasPricePerM2, metalTrimSheetCost, metalTrimFastenerCost } from "../src/finishes.js";
import { totalCableLength, totalCorrugatedTubeLength } from "../src/electrical.js";
import { preliminaryBoilerPowerKw, packLoopsIntoCoils, collectorFeedLength, checkLoopLimit } from "../src/heating.js";

describe("раздел 23 п.18-19: человеко-часы и труд", () => {
  it("4×7×10=280 ч; 550 ₽ → 154000; выездная 4×7×1000=28000", () => {
    const hours = humanHours(4, 7, 10);
    expect(hours.toNumber()).toBe(280);
    expect(laborCost(hours, 550).toNumber()).toBe(154000);
    expect(siteAllowance(4, 7, 1000).toNumber()).toBe(28000);
  });

  it("историческая бригада: 1560 ч → 858000; гибка отдельно 15 ч → 8250", () => {
    expect(laborCost(1560, 550).toNumber()).toBe(858000);
    expect(laborCost(15, 550).toNumber()).toBe(8250);
  });
});

describe("раздел 16.1/23.1: удалённый монтаж 20 дней вместо 10", () => {
  it("труд 520000 ₽ при прежних людях и ставках", () => {
    const result = computeRemoteInstallLabor({ people: 4, days: 20, hoursPerDay: 10, ratePerHour: 550, allowancePerPersonPerDay: 1000 });
    expect(result.totalLaborCost.toNumber()).toBe(520000);
  });

  it("базовый сценарий 10 дней даёт 260000 ₽", () => {
    const result = computeRemoteInstallLabor({ people: 4, days: 10, hoursPerDay: 10, ratePerHour: 550, allowancePerPersonPerDay: 1000 });
    expect(result.totalLaborCost.toNumber()).toBe(260000);
  });
});

describe("раздел 23 п.20: накладные", () => {
  it("(200000×0.65+40000+350000+40000)×12/20=336000; с амортизацией 70000 → 406000", () => {
    const monthly = monthlyOverheadTotal({
      adsMonthly: 200000,
      adsShareForModularHouses: 0.65,
      officeMonthly: 40000,
      workshopRentMonthly: 350000,
      workshopElectricityMonthly: 40000,
    });
    expect(monthly.toNumber()).toBe(560000);
    const yearly = yearlyOverheadTotal({
      adsMonthly: 200000,
      adsShareForModularHouses: 0.65,
      officeMonthly: 40000,
      workshopRentMonthly: 350000,
      workshopElectricityMonthly: 40000,
    });
    expect(yearly.toNumber()).toBe(6720000);
    const perHouse = overheadPerHouse(yearly, 20);
    expect(perHouse.toNumber()).toBe(336000);
    expect(fullOverheadPerHouseWithAmortization(perHouse, 70000).toNumber()).toBe(406000);
  });
});

describe("раздел 23 п.21-22: цена и прибыль", () => {
  it("целевая прибыль 2 000 000 при C=5 200 000: цена до округления 7826086.9565..., после округления до 50000 → 7850000, прибыль 2022000", () => {
    const result = computePrice(
      { mode: "target_profit_absolute", fullCostC: 5200000, targetProfitG: 2000000, taxRateT: 0.06, managerCommissionM: 0.02 },
      50000
    );
    expect(result.priceBeforeRounding.toFixed(4)).toBe("7826086.9565");
    expect(result.price.toNumber()).toBe(7850000);
    expect(result.profit.toNumber()).toBe(2022000);
  });

  it("исторический пример: C=5533646.68, P=8300000 → налог 498000, комиссия 166000, прибыль 2102353.32", () => {
    const { tax, commission, profit } = profitFromPrice(5533646.68, 8300000, 0.06, 0.02);
    expect(tax.toNumber()).toBe(498000);
    expect(commission.toNumber()).toBe(166000);
    expect(profit.toFixed(2)).toBe("2102353.32");
  });

  it("защита основы: при отключении допов основа проходит проверку минимальной прибыли", () => {
    const check = checkBaseProtection(3000000, 4500000, 0.06, 0.02, 500000);
    expect(check.passes).toBe(true);
  });

  it("некорректный знаменатель (сумма ставок ≥ 1) выбрасывает понятную ошибку, а не даёт ложный итог", () => {
    expect(() =>
      computePrice({ mode: "target_profit_share", fullCostC: 100, targetShareG: 0.5, taxRateT: 0.3, managerCommissionM: 0.25 })
    ).toThrow();
  });
});

describe("раздел 19: опции идемпотентны и не задваивают физический узел", () => {
  it("розетка насоса от опции отопления не дублируется опцией тёплого пола", () => {
    let state = emptyState();
    state = applyEffect(state, { action: "ADD", nodeKey: "kotelnaya.pump.socket", optionId: "heating_pump" });
    state = applyEffect(state, { action: "ADD", nodeKey: "kotelnaya.pump.socket", optionId: "warm_floor" });
    expect(state.size).toBe(1);
    expect(state.get("kotelnaya.pump.socket")!.optionId).toBe("heating_pump");
  });

  it("повторное включение той же опции не удваивает строку", () => {
    let state = emptyState();
    const effect = { action: "ADD" as const, nodeKey: "roof.plate", optionId: "floating_ceiling" };
    state = applyEffect(state, effect);
    state = applyEffect(state, effect);
    expect(state.size).toBe(1);
  });

  it("выключение опции удаляет только её собственные зависимости", () => {
    let state = emptyState();
    state = applyEffects(state, [
      { action: "ADD", nodeKey: "a", optionId: "opt1" },
      { action: "ADD", nodeKey: "b", optionId: "opt2" },
    ]);
    state = retractOption(state, "opt1");
    expect(state.has("a")).toBe(false);
    expect(state.has("b")).toBe(true);
  });
});

describe("раздел 23 п.9: плёнка", () => {
  it("100 м² с общим запасом 10% даёт 110 м², не 121", () => {
    expect(areaWithReserve(100, 10).toNumber()).toBe(110);
  });

  it("режим расхода: 110/70 рулона; закупка целыми — 2, излишек 30 м²", () => {
    expect(rollsFractional(110, 70).toFixed(4)).toBe("1.5714");
    expect(rollsWhole(110, 70)).toBe(2);
    expect(wholeRollSurplusM2(110, 70).toNumber()).toBe(30);
  });
});

describe("раздел 23 п.17: освещение", () => {
  it("62 рабочих GU10; LED-люстры не добавляют GU10; резерв 10% округляется до 7", () => {
    const result = totalGu10LampsWithReserve([
      { label: "трек. головки", count: 20, patronsPerUnit: 1, hasBuiltInLed: false },
      { label: "внутренние точечные", count: 12, patronsPerUnit: 1, hasBuiltInLed: false },
      { label: "террасные точечные", count: 6, patronsPerUnit: 1, hasBuiltInLed: false },
      { label: "фасадные (2 патрона)", count: 12, patronsPerUnit: 2, hasBuiltInLed: false },
      { label: "LED-люстры", count: 4, patronsPerUnit: 0, hasBuiltInLed: true },
    ]);
    expect(result.base).toBe(62);
    expect(result.reserve).toBe(7);
    expect(result.total).toBe(69);
  });
});

describe("раздел 23 п.10, 12: плитка и потолок", () => {
  it("душевой угол 1×1 м, две стены 2,5 м и пол = 6 м²", () => {
    expect(
      tiledZoneAreaM2(1, [
        { lengthM: 1, heightM: 2.5 },
        { lengthM: 1, heightM: 2.5 },
      ]).toNumber()
    ).toBe(6);
  });

  it("полотно 420 + резка 2% = 428.40, не 420.84", () => {
    expect(ceilingCanvasPricePerM2(420, 2).toFixed(2)).toBe("428.40");
  });
});

describe("раздел 23 п.1: электрика — резерв не удваивается", () => {
  it("575 м кабеля + 20% = 690 м, а не 828", () => {
    expect(totalCableLength([{ label: "весь набор", baseLengthM: 575 }], 20).toNumber()).toBe(690);
  });

  it("гофра 531 (Ø20) и 36 (Ø25) → 637.2 и 43.2, итог 680.4, не смешивается с 690 кабеля", () => {
    const result = totalCorrugatedTubeLength(
      [
        { diameterLabel: "Ø20", baseLengthM: 531 },
        { diameterLabel: "Ø25", baseLengthM: 36 },
      ],
      20
    );
    expect(result.byDiameter["Ø20"].toFixed(1)).toBe("637.2");
    expect(result.byDiameter["Ø25"].toFixed(1)).toBe("43.2");
    expect(result.total.toFixed(1)).toBe("680.4");
    expect(result.total.toNumber()).not.toBe(690);
  });
});

describe("раздел 23.1: крепёж металлических доборов", () => {
  it("10×3×1.25×650=24375; 5%=1218.75 отдельно от гибки", () => {
    const material = metalTrimSheetCost(10, 1.25, 3, 650);
    expect(material.toNumber()).toBe(24375);
    expect(metalTrimFastenerCost(material, 5).toNumber()).toBe(1218.75);
  });
});

describe("раздел 14: тёплый пол", () => {
  it("мощность котла Q=A×0.1", () => {
    expect(preliminaryBoilerPowerKw(60).toNumber()).toBe(6);
  });

  it("10 петель по 60 м требуют 4 бухты по 200 м", () => {
    const loops = Array(10).fill(60);
    const result = packLoopsIntoCoils(loops, 200);
    expect(result.totalStockUsed).toBe(4);
  });

  it("подводка TOTAL 3 м не становится 3×число петель", () => {
    expect(collectorFeedLength({ scope: "TOTAL", totalLengthM: 3 }).toNumber()).toBe(3);
    expect(collectorFeedLength({ scope: "PER_LOOP", perLoopLengthM: 3, loopCount: 10 }).toNumber()).toBe(30);
  });

  it("петля длиннее предела помечается превышением", () => {
    expect(checkLoopLimit(65, 60).exceeds).toBe(true);
    expect(checkLoopLimit(55, 60).exceeds).toBe(false);
  });
});
