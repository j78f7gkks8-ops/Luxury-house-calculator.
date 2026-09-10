import PDFDocument from "pdfkit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EstimateResult } from "../domain/estimate/types.js";
import { allocateClientPricePerBlock } from "../domain/estimate/clientAllocation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_REGULAR = path.resolve(__dirname, "../../assets/fonts/DejaVuSans.ttf");
const FONT_BOLD = path.resolve(__dirname, "../../assets/fonts/DejaVuSans-Bold.ttf");

const STATUS_LABELS: Record<string, string> = {
  confirmed: "подтверждено",
  from_drawing_needs_check: "по чертежу, требует сверки",
  preliminary_by_analog: "предварительно, по аналогу",
  needs_price: "цена уточняется",
  needs_size: "размер уточняется",
  version_conflict: "требует уточнения (конфликт версий)",
  included_in_package: "включено в пакет",
};

export interface ClientQuoteMeta {
  quoteNumber: string;
  date: string;
  version: number;
  customerName: string;
  projectName: string;
  validUntil?: string;
}

/**
 * Раздел 21: клиентский PDF. НИКОГДА не печатает unitPrice/amount строк, закупочные цены,
 * себестоимость, наценку или комиссию — только распределённую цену блока и итог.
 * ВАЖНО: вызывающий маршрут обязан пройти проверку роли (MANAGER/OWNER) до вызова.
 */
export function buildClientPdf(meta: ClientQuoteMeta, estimate: EstimateResult): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("regular", FONT_REGULAR).registerFont("bold", FONT_BOLD);
    doc.font("bold").fontSize(18).text("Luxury House — коммерческое предложение", { align: "left" });
    doc.moveDown(0.3);
    doc.font("regular").fontSize(10);
    doc.text(`Предложение № ${meta.quoteNumber} от ${meta.date}, версия ${meta.version}`);
    doc.text(`Клиент: ${meta.customerName}`);
    doc.text(`Объект: ${meta.projectName}`);
    if (meta.validUntil) doc.text(`Действительно до: ${meta.validUntil}`);
    doc.moveDown();

    const allocations = allocateClientPricePerBlock(estimate);

    for (const block of estimate.blocks) {
      if (block.id === "overhead") continue; // раздел 18: налог/комиссия/накладные клиенту отдельными строками не выставляются
      const alloc = allocations.find((a) => a.blockId === block.id);
      doc.font("bold").fontSize(12).text(block.label, { continued: true });
      doc.font("regular").text(`   ${(alloc?.clientPrice ?? 0).toLocaleString("ru-RU")} ₽`, { align: "right" });
      doc.font("regular").fontSize(9);
      for (const l of block.lines) {
        const statusLabel = STATUS_LABELS[l.status] ?? l.status;
        const qtyPart = l.quantity != null ? `${l.quantity}${l.unit ? " " + l.unit : ""} — ` : "";
        doc.text(`  • ${l.label} ${qtyPart}[${statusLabel}]`);
      }
      doc.moveDown(0.4);
    }

    doc.moveDown(0.5);
    doc.font("bold").fontSize(13).text(`Итоговая цена предложения: ${estimate.pricing.price.toLocaleString("ru-RU")} ₽`);

    if (estimate.gaps.length > 0) {
      doc.moveDown();
      doc.font("bold").fontSize(11).text("Существенные незаполненные пункты:");
      doc.font("regular").fontSize(9);
      for (const g of estimate.gaps) doc.text(`  • ${g.message}`);
    }

    doc.moveDown();
    doc.font("regular").fontSize(8).fillColor("gray").text(
      "Предварительные позиции (по аналогу) уточняются после проверки рабочих чертежей. Цены пересчитываются при изменении комплектации.",
      { align: "left" }
    );

    doc.end();
  });
}
