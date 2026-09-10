import { Decimal, d, Num } from "./decimal.js";

/**
 * Раздел 7.5 (уровень 3) / 16.2: масштабирование по аналогу для отсутствующих данных.
 * H = H_аналога × объём_новый / объём_аналога × коэффициент_сложности.
 * Коэффициент сложности 1 означает ОТСУТСТВИЕ поправки, а не доказанную одинаковую
 * производительность — статус всегда "preliminary_by_analog", никогда не выдаётся как факт.
 */
export interface AnalogScalingInput {
  analogLabel: string;
  analogValue: Num; // например, человеко-часы или ₽ аналога
  analogDriverVolume: Num; // физический драйвер аналога (площадь, объём дерева, число узлов)
  newDriverVolume: Num;
  complexityCoefficient?: Num; // по умолчанию 1
}

export interface AnalogScalingResult {
  scaledValue: Decimal;
  ratio: Decimal;
  status: "preliminary_by_analog";
  basis: string;
}

export function scaleByAnalog(input: AnalogScalingInput): AnalogScalingResult {
  const analogDriver = d(input.analogDriverVolume);
  if (analogDriver.lte(0)) {
    throw new Error(`Объём аналога "${input.analogLabel}" должен быть положительным для масштабирования`);
  }
  const ratio = d(input.newDriverVolume).dividedBy(analogDriver);
  const coeff = d(input.complexityCoefficient ?? 1);
  const scaledValue = d(input.analogValue).times(ratio).times(coeff);
  return {
    scaledValue,
    ratio,
    status: "preliminary_by_analog",
    basis: `${input.analogLabel}: ${input.newDriverVolume}/${input.analogDriverVolume} × ${coeff.toString()}`,
  };
}
