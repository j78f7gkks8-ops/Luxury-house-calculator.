import { CalcError, money, Money, roundUpToStep } from "./money";

/** Sale price & profit protection - §18. */
export interface TaxCommissionRates {
  /** t: tax fraction of the final sale price. */
  taxFraction: number;
  /** m: manager commission fraction of the final sale price. */
  commissionFraction: number;
}

function assertRateFraction(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new CalcError(`Некорректная доля "${name}"`, "INVALID_RATE", { name, value });
  }
}

function assertPositive(name: string, value: Money) {
  if (money(value).lte(0)) {
    throw new CalcError(`"${name}" должно быть положительным`, "INVALID_POSITIVE_VALUE", { name });
  }
}

/** Mode 1: markup over full cost. P = C * (1 + k). */
export function priceByMarkup(fullCost: Money, markupFraction: number): Money {
  assertPositive("полная себестоимость", fullCost);
  if (markupFraction < 0) throw new CalcError("Наценка не может быть отрицательной", "INVALID_MARKUP");
  return money(fullCost).times(1 + markupFraction);
}

/** Mode 2: target profit in rubles. P = (C + G) / (1 - t - m). */
export function priceByTargetProfit(fullCost: Money, targetProfit: Money, rates: TaxCommissionRates): Money {
  assertPositive("полная себестоимость", fullCost);
  assertRateFraction("налог", rates.taxFraction);
  assertRateFraction("комиссия", rates.commissionFraction);
  const denominator = 1 - rates.taxFraction - rates.commissionFraction;
  if (denominator <= 0) {
    throw new CalcError("Знаменатель цены (1 - t - m) должен быть положительным", "INVALID_DENOMINATOR");
  }
  return money(fullCost).plus(targetProfit).dividedBy(denominator);
}

/** Mode 3: target profit share of price. P = C / (1 - t - m - g). */
export function priceByTargetProfitShare(
  fullCost: Money,
  targetProfitShare: number,
  rates: TaxCommissionRates,
): Money {
  assertPositive("полная себестоимость", fullCost);
  assertRateFraction("налог", rates.taxFraction);
  assertRateFraction("комиссия", rates.commissionFraction);
  assertRateFraction("целевая доля прибыли", targetProfitShare);
  const denominator = 1 - rates.taxFraction - rates.commissionFraction - targetProfitShare;
  if (denominator <= 0) {
    throw new CalcError(
      "Знаменатель цены (1 - t - m - g) должен быть положительным",
      "INVALID_DENOMINATOR",
    );
  }
  return money(fullCost).dividedBy(denominator);
}

export interface PriceEvaluation {
  price: Money;
  fullCost: Money;
  tax: Money;
  commission: Money;
  profit: Money;
  markup: number; // P/C - 1
  marginAfterTaxCommission: number; // Profit / P
}

/** Profit = P - C - P*t - P*m. Markup and margin are NOT interchangeable (§18). */
export function evaluatePrice(price: Money, fullCost: Money, rates: TaxCommissionRates): PriceEvaluation {
  assertPositive("цена", price);
  assertPositive("полная себестоимость", fullCost);
  const p = money(price);
  const c = money(fullCost);
  const tax = p.times(rates.taxFraction);
  const commission = p.times(rates.commissionFraction);
  const profit = p.minus(c).minus(tax).minus(commission);
  return {
    price: p,
    fullCost: c,
    tax,
    commission,
    profit,
    markup: p.dividedBy(c).minus(1).toNumber(),
    marginAfterTaxCommission: profit.dividedBy(p).toNumber(),
  };
}

export interface RoundingPolicy {
  lineStep?: Money;
  totalStep?: Money;
}

/** Round a total up to the policy's step, returning the rounding delta as its own explicit line. */
export function applyRoundingPolicy(rawTotal: Money, policy: RoundingPolicy): { roundedTotal: Money; roundingDelta: Money } {
  const step = policy.totalStep ?? money(1);
  const roundedTotal = roundUpToStep(rawTotal, step);
  return { roundedTotal, roundingDelta: roundedTotal.minus(rawTotal) };
}

/**
 * The base configuration ("дом без внутренней отделки") must clear its own
 * minimum profit even with every option disabled (§18, test #23).
 */
export interface BaseProtectionCheck {
  ok: boolean;
  baseProfit: Money;
  minimumRequiredProfit: Money;
  shortfall: Money;
}

export function checkBaseProfitProtected(
  basePrice: Money,
  baseFullCost: Money,
  minimumRequiredProfit: Money,
  rates: TaxCommissionRates,
): BaseProtectionCheck {
  const evaluation = evaluatePrice(basePrice, baseFullCost, rates);
  const shortfall = money(minimumRequiredProfit).minus(evaluation.profit);
  return {
    ok: evaluation.profit.gte(minimumRequiredProfit),
    baseProfit: evaluation.profit,
    minimumRequiredProfit: money(minimumRequiredProfit),
    shortfall: shortfall.gt(0) ? shortfall : money(0),
  };
}

/** Discount below the manager's allowed floor requires an owner decision tied to a specific estimate version. */
export interface DiscountApproval {
  estimateRevisionId: string;
  approvedByUserId: string;
  approvedPrice: Money;
  reason: string;
  approvedAt: Date;
}

export function isDiscountWithinManagerLimit(proposedPrice: Money, minimumAllowedPrice: Money): boolean {
  return money(proposedPrice).gte(minimumAllowedPrice);
}

/** Any change to cost/composition invalidates a prior discount approval - it is tied to one exact revision. */
export function isApprovalStillValid(approval: DiscountApproval, currentRevisionId: string): boolean {
  return approval.estimateRevisionId === currentRevisionId;
}
