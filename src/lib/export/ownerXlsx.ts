import ExcelJS from "exceljs";
import { EstimateSnapshot, COMMERCIAL_BLOCK_LABELS } from "@/lib/domain/snapshot";

/** Full internal estimate - owner only (§21, §3). Every column, including cost, is real. */
export async function buildOwnerXlsx(snapshot: EstimateSnapshot, meta: { projectTitle: string; revisionVersion: number }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Luxury House Calculator";
  wb.created = new Date();

  const linesSheet = wb.addWorksheet("Смета по строкам");
  linesSheet.columns = [
    { header: "Блок", key: "block", width: 22 },
    { header: "Материал/работа", key: "name", width: 40 },
    { header: "Кол-во", key: "qty", width: 10 },
    { header: "Ед.", key: "unit", width: 8 },
    { header: "Цена/ед., ₽", key: "unitCost", width: 14 },
    { header: "Сумма, ₽", key: "total", width: 14 },
    { header: "Статус", key: "status", width: 22 },
    { header: "Источник", key: "source", width: 30 },
    { header: "Пояснение/формула", key: "formula", width: 45 },
  ];
  linesSheet.getRow(1).font = { bold: true };
  for (const l of snapshot.compositionLines) {
    linesSheet.addRow({
      block: COMMERCIAL_BLOCK_LABELS[l.block],
      name: l.name,
      qty: l.qty ?? "объём не определён",
      unit: l.unit,
      unitCost: l.unitCostRub,
      total: l.totalCostRub,
      status: l.status,
      source: l.source,
      formula: l.formulaExplanation,
    });
  }

  const laborSheet = wb.addWorksheet("Человеко-часы");
  laborSheet.columns = [
    { header: "Этап", key: "name", width: 30 },
    { header: "Люди", key: "people", width: 8 },
    { header: "Дни", key: "days", width: 8 },
    { header: "Часов/день", key: "hoursPerDay", width: 12 },
    { header: "Всего часов", key: "hours", width: 12 },
    { header: "Ставка, ₽/ч", key: "rate", width: 12 },
    { header: "Стоимость, ₽", key: "cost", width: 14 },
  ];
  laborSheet.getRow(1).font = { bold: true };
  for (const s of snapshot.laborStages) {
    laborSheet.addRow({ name: s.name, people: s.people, days: s.days, hoursPerDay: s.hoursPerDay, hours: s.hours, rate: s.ratePerHourRub, cost: s.costRub });
  }

  const summarySheet = wb.addWorksheet("Итоги");
  summarySheet.columns = [
    { header: "Показатель", key: "k", width: 40 },
    { header: "Значение", key: "v", width: 20 },
  ];
  summarySheet.getRow(1).font = { bold: true };
  const rows: [string, string | number][] = [
    ["Проект", meta.projectTitle],
    ["Версия расчёта", meta.revisionVersion],
    ["Шаблон", snapshot.templateLabel],
    ["Прямые затраты D, ₽", snapshot.costSummary.directCostsRub],
    [`Резерв R (${(snapshot.costSummary.reserveFraction * 100).toFixed(1)}%), ₽`, snapshot.costSummary.reserveRub],
    ["Накладные + амортизация O, ₽", snapshot.costSummary.overheadRub],
    ["Полная себестоимость C = D+R+O, ₽", snapshot.costSummary.fullCostRub],
    ["Режим цены", snapshot.priceSummary.mode],
    ["Цена до округления, ₽", snapshot.priceSummary.rawPriceRub],
    ["Цена (округлённая), ₽", snapshot.priceSummary.roundedPriceRub],
    ["Разница округления, ₽", snapshot.priceSummary.roundingDeltaRub],
    ["Налог, ₽", snapshot.priceSummary.taxRub],
    ["Комиссия менеджера, ₽", snapshot.priceSummary.commissionRub],
    ["Прибыль, ₽", snapshot.priceSummary.profitRub],
    ["Наценка P/C - 1", (snapshot.priceSummary.markup * 100).toFixed(2) + "%"],
    ["Маржа Profit/P", (snapshot.priceSummary.marginAfterTaxCommission * 100).toFixed(2) + "%"],
    ["Минимально допустимая цена, ₽", snapshot.priceSummary.minimumAllowedPriceRub],
    ["Базовая комплектация защищена (мин. прибыль)", snapshot.priceSummary.baseProfitProtected ? "Да" : "Нет"],
    ["Строк без цены", snapshot.costSummary.linesWithMissingPrice.join(", ") || "—"],
  ];
  for (const [k, v] of rows) summarySheet.addRow({ k, v });

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
