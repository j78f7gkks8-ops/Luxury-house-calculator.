import { Decimal, d, Num, roundUpToStep } from "./decimal.js";

/**
 * Раздел 18: продажная цена и защита прибыли. Три режима цены; результат всегда проверяется
 * по факту (Profit = P - C - P×t - P×m), т.к. наценка и доля прибыли — разные показатели.
 */
export interface PricingInputsBase {
  fullCostC: Num;
  taxRateT: Num; // например 0.06
  managerCommissionM: Num; // например 0.02
}

export interface MarkupPricing extends PricingInputsBase {
  mode: "markup";
  markupK: Num; // например 0.55 = 55%
}

export interface TargetProfitPricing extends PricingInputsBase {
  mode: "target_profit_absolute";
  targetProfitG: Num; // в рублях
}

export interface TargetMarginPricing extends PricingInputsBase {
  mode: "target_profit_share";
  targetShareG: Num; // доля прибыли в цене, 0..1
}

export type PricingInput = MarkupPricing | TargetProfitPricing | TargetMarginPricing;

export interface PricingResult {
  priceBeforeRounding: Decimal;
  price: Decimal;
  tax: Decimal;
  commission: Decimal;
  profit: Decimal;
  markup: Decimal; // P/C - 1
  marginAfterCosts: Decimal; // profit / P
}

function validateDenominator(denominator: Decimal): void {
  if (denominator.lte(0)) {
    throw new Error("Некорректные параметры цены: знаменатель формулы должен быть положительным (проверьте налог/комиссию/долю прибыли)");
  }
}

export function computePrice(input: PricingInput, roundingStep?: Num): PricingResult {
  const C = d(input.fullCostC);
  const t = d(input.taxRateT);
  const m = d(input.managerCommissionM);
  if (C.lte(0)) throw new Error("Себестоимость должна быть положительной");

  let priceBeforeRounding: Decimal;

  if (input.mode === "markup") {
    priceBeforeRounding = C.times(d(1).plus(input.markupK));
  } else if (input.mode === "target_profit_absolute") {
    const denominator = d(1).minus(t).minus(m);
    validateDenominator(denominator);
    priceBeforeRounding = C.plus(input.targetProfitG).dividedBy(denominator);
  } else {
    const denominator = d(1).minus(t).minus(m).minus(input.targetShareG);
    validateDenominator(denominator);
    priceBeforeRounding = C.dividedBy(denominator);
  }

  const price = roundingStep ? roundUpToStep(priceBeforeRounding, roundingStep) : priceBeforeRounding;
  if (price.lte(0)) throw new Error("Расчётная цена должна быть положительной");

  const tax = price.times(t);
  const commission = price.times(m);
  const profit = price.minus(C).minus(tax).minus(commission);
  const markup = price.dividedBy(C).minus(1);
  const marginAfterCosts = profit.dividedBy(price);

  return { priceBeforeRounding, price, tax, commission, profit, markup, marginAfterCosts };
}

/** Проверка фактической прибыли по уже известным C и P (контроль арифметики, раздел 23 п.22). */
export function profitFromPrice(fullCostC: Num, price: Num, taxRateT: Num, managerCommissionM: Num) {
  const P = d(price);
  const tax = P.times(taxRateT);
  const commission = P.times(managerCommissionM);
  const profit = P.minus(fullCostC).minus(tax).minus(commission);
  return { tax, commission, profit };
}

/**
 * Раздел 18: "Защита основной комплектации" — у основы своя минимальная цена/прибыль.
 * Проверяет, что цена блока обеспечивает не меньше заданной минимальной прибыли.
 */
export interface BaseProtectionCheck {
  passes: boolean;
  minimumRequiredPrice: Decimal;
  actualProfit: Decimal;
}

export function checkBaseProtection(
  baseFullCostC: Num,
  basePrice: Num,
  taxRateT: Num,
  managerCommissionM: Num,
  minimumProfit: Num
): BaseProtectionCheck {
  const { profit } = profitFromPrice(baseFullCostC, basePrice, taxRateT, managerCommissionM);
  const denominator = d(1).minus(taxRateT).minus(managerCommissionM);
  validateDenominator(denominator);
  const minimumRequiredPrice = d(baseFullCostC).plus(minimumProfit).dividedBy(denominator);
  return { passes: profit.gte(minimumProfit), minimumRequiredPrice, actualProfit: profit };
}
