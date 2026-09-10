import ExcelJS from "exceljs";
import type { EstimateResult } from "../domain/estimate/types.js";

/**
 * Раздел 21: "внутренняя смета владельца XLSX". Полный доступ к ценам — вызывающая сторона
 * (маршрут) обязана убедиться, что это владелец, до вызова этой функции.
 */
export async function buildOwnerXlsx(projectName: string, variantLabel: string, estimate: EstimateResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Luxury House Calculator";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Сводка");
  summary.columns = [
    { header: "Показатель", key: "label", width: 45 },
    { header: "Сумма, ₽", key: "value", width: 20 },
  ];
  summary.addRows([
    { label: `Проект: ${projectName}`, value: "" },
    { label: `Вариант: ${variantLabel}`, value: "" },
    { label: "", value: "" },
    { label: "Прямые затраты (D)", value: estimate.directCostsD },
    { label: "Резерв (R)", value: estimate.reserveR },
    { label: "Накладные (O)", value: estimate.overheadO },
    { label: "Амортизация (A)", value: estimate.amortizationA },
    { label: "Полная себестоимость (C = D+R+O+A)", value: estimate.fullCostC },
    { label: "", value: "" },
    { label: "Цена продажи", value: estimate.pricing.price },
    { label: "Налог", value: estimate.pricing.tax },
    { label: "Комиссия менеджера", value: estimate.pricing.commission },
    { label: "Прибыль", value: estimate.pricing.profit },
    { label: "Наценка, %", value: estimate.pricing.markupPct },
    { label: "Маржа после затрат, %", value: estimate.pricing.marginAfterCostsPct },
  ]);
  summary.getColumn("value").numFmt = "#,##0.00";
  summary.getRow(1).font = { bold: true };

  const linesSheet = workbook.addWorksheet("Строки сметы");
  linesSheet.columns = [
    { header: "Блок", key: "block", width: 28 },
    { header: "Строка", key: "label", width: 50 },
    { header: "Кол-во", key: "quantity", width: 12 },
    { header: "Ед.", key: "unit", width: 10 },
    { header: "Цена за ед., ₽", key: "unitPrice", width: 16 },
    { header: "Сумма, ₽", key: "amount", width: 16 },
    { header: "Категория", key: "category", width: 14 },
    { header: "Статус", key: "status", width: 24 },
    { header: "Комментарий", key: "note", width: 50 },
  ];
  linesSheet.getRow(1).font = { bold: true };
  for (const block of estimate.blocks) {
    for (const l of block.lines) {
      linesSheet.addRow({
        block: block.label,
        label: l.label,
        quantity: l.quantity ?? "",
        unit: l.unit ?? "",
        unitPrice: l.unitPrice ?? "",
        amount: l.amount ?? "нет данных",
        category: l.costCategory,
        status: l.status,
        note: l.note ?? "",
      });
    }
  }
  linesSheet.getColumn("amount").numFmt = "#,##0.00";
  linesSheet.getColumn("unitPrice").numFmt = "#,##0.00";

  if (estimate.gaps.length > 0) {
    const gapsSheet = workbook.addWorksheet("Незаполненные пункты");
    gapsSheet.columns = [
      { header: "Код", key: "code", width: 30 },
      { header: "Сообщение", key: "message", width: 80 },
      { header: "Блокирует финальную смету", key: "blocks", width: 24 },
    ];
    gapsSheet.getRow(1).font = { bold: true };
    for (const g of estimate.gaps) gapsSheet.addRow({ code: g.code, message: g.message, blocks: g.blocksFinal ? "да" : "нет" });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
