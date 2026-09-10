import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import type { EstimateResult } from "../domain/estimate/types.js";
import { allocateClientPricePerBlock } from "../domain/estimate/clientAllocation.js";
import type { ClientQuoteMeta } from "./pdf.js";

const STATUS_LABELS: Record<string, string> = {
  confirmed: "подтверждено",
  from_drawing_needs_check: "по чертежу, требует сверки",
  preliminary_by_analog: "предварительно, по аналогу",
  needs_price: "цена уточняется",
  needs_size: "размер уточняется",
  version_conflict: "требует уточнения (конфликт версий)",
  included_in_package: "включено в пакет",
};

/** Раздел 21: "редактируемый DOCX" — та же клиентская смета, без цен закупки/себестоимости. */
export async function buildClientDocx(meta: ClientQuoteMeta, estimate: EstimateResult): Promise<Buffer> {
  const allocations = allocateClientPricePerBlock(estimate);

  const children: Paragraph[] = [
    new Paragraph({ text: "Luxury House — коммерческое предложение", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: `Предложение № ${meta.quoteNumber} от ${meta.date}, версия ${meta.version}` }),
    new Paragraph({ text: `Клиент: ${meta.customerName}` }),
    new Paragraph({ text: `Объект: ${meta.projectName}` }),
    new Paragraph({ text: "" }),
  ];

  for (const block of estimate.blocks) {
    if (block.id === "overhead") continue;
    const alloc = allocations.find((a) => a.blockId === block.id);
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun(block.label + "  "),
          new TextRun({ text: `${(alloc?.clientPrice ?? 0).toLocaleString("ru-RU")} ₽`, bold: true }),
        ],
      })
    );
    for (const l of block.lines) {
      const statusLabel = STATUS_LABELS[l.status] ?? l.status;
      const qtyPart = l.quantity != null ? `${l.quantity}${l.unit ? " " + l.unit : ""} — ` : "";
      children.push(new Paragraph({ text: `• ${l.label} ${qtyPart}[${statusLabel}]` }));
    }
  }

  children.push(
    new Paragraph({ text: "" }),
    new Paragraph({
      children: [new TextRun({ text: `Итоговая цена предложения: ${estimate.pricing.price.toLocaleString("ru-RU")} ₽`, bold: true, size: 28 })],
    })
  );

  if (estimate.gaps.length > 0) {
    children.push(new Paragraph({ text: "" }), new Paragraph({ heading: HeadingLevel.HEADING_3, text: "Существенные незаполненные пункты" }));
    for (const g of estimate.gaps) children.push(new Paragraph({ text: `• ${g.message}` }));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
