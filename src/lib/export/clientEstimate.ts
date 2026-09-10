import { EstimateSnapshot, COMMERCIAL_BLOCK_LABELS, CommercialBlock } from "@/lib/domain/snapshot";
import { escapeHtml, formatRub, wrapHtmlDocument } from "./htmlTemplate";

export interface ClientDocMeta {
  projectTitle: string;
  customerName: string;
  revisionVersion: number;
  offerValidUntil?: string;
}

/**
 * §21: client document shows chosen materials, block prices and the total -
 * NEVER cost, margin, tax/commission rates, purchase links or internal
 * comments. Block "prices" here are the SALE price allocated proportionally
 * to each block's share of direct cost, not the cost itself - the client
 * never sees a raw cost number, even indirectly, from this function.
 */
function blockPriceShares(snapshot: EstimateSnapshot): Map<CommercialBlock, number | null> {
  const totalDirect = snapshot.costSummary.directCostsRub;
  const totalPrice = snapshot.priceSummary.roundedPriceRub;
  const byBlock = new Map<CommercialBlock, number>();
  let hasUnknown = false;
  for (const l of snapshot.compositionLines) {
    if (l.totalCostRub === null) {
      hasUnknown = true;
      continue;
    }
    byBlock.set(l.block, (byBlock.get(l.block) ?? 0) + l.totalCostRub);
  }
  const shares = new Map<CommercialBlock, number | null>();
  for (const [block, cost] of byBlock.entries()) {
    shares.set(block, totalDirect > 0 ? Math.round((cost / totalDirect) * totalPrice) : null);
  }
  if (hasUnknown) {
    // any block containing an unpriced required line keeps an honest "not final" price
    for (const l of snapshot.compositionLines) {
      if (l.totalCostRub === null) shares.set(l.block, null);
    }
  }
  return shares;
}

export function clientEstimateHtml(snapshot: EstimateSnapshot, meta: ClientDocMeta): string {
  const shares = blockPriceShares(snapshot);

  const blocksHtml = snapshot.clientDescription
    .map((block) => {
      const price = shares.get(block.block);
      return `
        <h2>${escapeHtml(block.title)}</h2>
        <ul>
          ${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
        <p class="muted">Цена блока: ${formatRub(price ?? null)}</p>
      `;
    })
    .join("");

  const missingCount = snapshot.costSummary.linesWithMissingPrice.length;
  const isPreliminary = !snapshot.readiness.isFullCost;

  const body = `
    <div class="header">
      <div>
        <h1>Luxury House</h1>
        <div class="muted">Коммерческое предложение</div>
      </div>
      <div style="text-align:right">
        <div>№ ${escapeHtml(meta.projectTitle)}, версия ${meta.revisionVersion}</div>
        <div class="muted">Дата: ${new Date(snapshot.createdAt).toLocaleDateString("ru-RU")}</div>
        ${meta.offerValidUntil ? `<div class="muted">Действительно до: ${escapeHtml(meta.offerValidUntil)}</div>` : ""}
      </div>
    </div>
    ${
      isPreliminary
        ? `<div class="price-box" style="border-color:#e0b877;background:#fff8ec">
             <strong>Предварительный расчёт.</strong> Итог ниже посчитан только по определённым позициям
             и не является полной ценой договора: часть обязательных блоков ещё уточняется.
           </div>`
        : ""
    }
    <p><strong>Клиент:</strong> ${escapeHtml(meta.customerName)}</p>
    <p><strong>Модель:</strong> ${escapeHtml(snapshot.templateLabel)}${
      snapshot.pileSummary ? `, ${escapeHtml(snapshot.pileSummary.variantName)}` : ""
    }</p>

    ${blocksHtml}

    ${
      snapshot.readiness.gaps.length > 0
        ? `<h2>Ожидают уточнения</h2>
           <p class="muted">${escapeHtml(snapshot.readiness.gaps.join("; "))}.</p>`
        : ""
    }

    <div class="price-box">
      <div class="muted">${isPreliminary ? "Предварительная цена по определённым позициям" : "Итоговая цена предложения"}</div>
      <div class="amount">${formatRub(snapshot.priceSummary.roundedPriceRub)}</div>
      ${missingCount > 0 ? `<div class="muted">Предварительное предложение: ${missingCount} позиций ожидают цены/уточнения и не включены в итог.</div>` : ""}
    </div>

    <div class="footer-note">
      Предложение подготовлено на основе выбранной комплектации и действующих справочников на дату формирования.
      Состав, материалы и итоговая цена соответствуют одному расчётному варианту (версия ${meta.revisionVersion}).
      Обновление цен каталога не изменяет уже выпущенное предложение - для перерасчёта требуется новая версия.
    </div>
  `;

  return wrapHtmlDocument(`Предложение ${meta.projectTitle}`, body);
}
