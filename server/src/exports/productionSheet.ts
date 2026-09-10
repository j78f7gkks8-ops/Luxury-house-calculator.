import ExcelJS from "exceljs";
import type { WorkshopEstimateView } from "../domain/estimate/roleViews.js";

/**
 * Раздел 21: "производственная ведомость PDF/XLSX без цен". Здесь нет unitPrice/amount —
 * WorkshopEstimateView уже лишён этих полей на уровне типов (roleViews.ts).
 */
export async function buildProductionXlsx(projectName: string, view: WorkshopEstimateView): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Производственное задание");
  sheet.columns = [
    { header: "Блок", key: "block", width: 28 },
    { header: "Позиция", key: "label", width: 55 },
    { header: "Кол-во", key: "quantity", width: 12 },
    { header: "Ед.", key: "unit", width: 10 },
    { header: "Статус", key: "status", width: 24 },
    { header: "Комментарий", key: "note", width: 55 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.insertRow(1, [`Проект: ${projectName} — без цен`]);
  sheet.mergeCells("A1:F1");
  sheet.getRow(2).font = { bold: true };

  for (const block of view.blocks) {
    for (const l of block.lines) {
      sheet.addRow({
        block: block.label,
        label: l.label,
        quantity: l.quantity ?? "",
        unit: l.unit ?? "",
        status: l.status,
        note: l.note ?? "",
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
