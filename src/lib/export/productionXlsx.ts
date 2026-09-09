import ExcelJS from "exceljs";
import { EstimateSnapshot, COMMERCIAL_BLOCK_LABELS } from "@/lib/domain/snapshot";

/** Production ведомость - no price columns at all, not just blanked cells (§3). */
export async function buildProductionXlsx(snapshot: EstimateSnapshot, meta: { projectTitle: string; revisionVersion: number }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Luxury House Calculator";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Производственная ведомость");
  sheet.columns = [
    { header: "Блок", key: "block", width: 22 },
    { header: "Материал/работа", key: "name", width: 40 },
    { header: "Кол-во", key: "qty", width: 10 },
    { header: "Ед.", key: "unit", width: 8 },
    { header: "Статус", key: "status", width: 22 },
  ];
  sheet.getRow(1).font = { bold: true };
  for (const l of snapshot.compositionLines) {
    sheet.addRow({ block: COMMERCIAL_BLOCK_LABELS[l.block], name: l.name, qty: l.qty, unit: l.unit, status: l.status });
  }

  const laborSheet = wb.addWorksheet("Человеко-часы");
  laborSheet.columns = [
    { header: "Этап", key: "name", width: 30 },
    { header: "Люди", key: "people", width: 8 },
    { header: "Дни", key: "days", width: 8 },
    { header: "Часов/день", key: "hoursPerDay", width: 12 },
    { header: "Всего часов", key: "hours", width: 12 },
  ];
  laborSheet.getRow(1).font = { bold: true };
  for (const s of snapshot.laborStages) {
    laborSheet.addRow({ name: s.name, people: s.people, days: s.days, hoursPerDay: s.hoursPerDay, hours: s.hours });
  }

  sheet.getCell("A" + (snapshot.compositionLines.length + 3)).value = `Проект: ${meta.projectTitle}, версия ${meta.revisionVersion}`;

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
