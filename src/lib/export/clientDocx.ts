import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import { EstimateSnapshot } from "@/lib/domain/snapshot";
import { ClientDocMeta } from "./clientEstimate";

function blockPriceSharesForDocx(snapshot: EstimateSnapshot): Map<string, number | null> {
  const totalDirect = snapshot.costSummary.directCostsRub;
  const totalPrice = snapshot.priceSummary.roundedPriceRub;
  const byBlock = new Map<string, number>();
  const unknownBlocks = new Set<string>();
  for (const l of snapshot.compositionLines) {
    if (l.totalCostRub === null) {
      unknownBlocks.add(l.block);
      continue;
    }
    byBlock.set(l.block, (byBlock.get(l.block) ?? 0) + l.totalCostRub);
  }
  const shares = new Map<string, number | null>();
  for (const [block, cost] of byBlock.entries()) {
    shares.set(block, totalDirect > 0 ? Math.round((cost / totalDirect) * totalPrice) : null);
  }
  for (const block of unknownBlocks) shares.set(block, null);
  return shares;
}

function formatRub(v: number | null): string {
  if (v === null) return "цена не задана";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
}

/** Editable client offer, DOCX - same client-safe content rule as the PDF (§21). */
export async function buildClientDocx(snapshot: EstimateSnapshot, meta: ClientDocMeta): Promise<Buffer> {
  const shares = blockPriceSharesForDocx(snapshot);

  const children: Paragraph[] = [
    new Paragraph({ text: "Luxury House", heading: HeadingLevel.TITLE }),
    new Paragraph({ text: "Коммерческое предложение", spacing: { after: 200 } }),
    new Paragraph({
      children: [new TextRun(`№ ${meta.projectTitle}, версия ${meta.revisionVersion}`)],
    }),
    new Paragraph({ children: [new TextRun(`Клиент: ${meta.customerName}`)] }),
    new Paragraph({
      children: [new TextRun(`Модель: ${snapshot.templateLabel}, ${snapshot.pileSummary.variantName}`)],
      spacing: { after: 200 },
    }),
  ];

  for (const block of snapshot.clientDescription) {
    children.push(new Paragraph({ text: block.title, heading: HeadingLevel.HEADING_2 }));
    for (const item of block.items) {
      children.push(new Paragraph({ text: `• ${item}` }));
    }
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `Цена блока: ${formatRub(shares.get(block.block) ?? null)}`, italics: true })],
        spacing: { after: 150 },
      }),
    );
  }

  children.push(
    new Paragraph({ text: "", spacing: { before: 200 } }),
    new Paragraph({
      children: [
        new TextRun({ text: `Итоговая цена предложения: ${formatRub(snapshot.priceSummary.roundedPriceRub)}`, bold: true, size: 28 }),
      ],
    }),
  );

  if (snapshot.costSummary.linesWithMissingPrice.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Предварительное предложение: ${snapshot.costSummary.linesWithMissingPrice.length} позиций ожидают цены/уточнения и не включены в итог.`,
            italics: true,
          }),
        ],
      }),
    );
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
