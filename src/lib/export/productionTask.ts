import { EstimateSnapshot, COMMERCIAL_BLOCK_LABELS, CommercialBlock, formatQty } from "@/lib/domain/snapshot";
import { escapeHtml, wrapHtmlDocument } from "./htmlTemplate";

export interface ProductionDocMeta {
  projectTitle: string;
  objectLabel: string; // house/module identifier - never the client's personal data (§3)
  revisionVersion: number;
}

function sanitizeFormula(formula: string): string {
  return formula.replace(/x [\d.,]+\s*₽/gi, "").replace(/цена не задана/gi, "").trim();
}

/** Production sheet: quantities, units, status and formulas only - never a price (§3, §21). */
export function productionTaskHtml(snapshot: EstimateSnapshot, meta: ProductionDocMeta): string {
  const byBlock = new Map<CommercialBlock, typeof snapshot.compositionLines>();
  for (const l of snapshot.compositionLines) {
    if (!byBlock.has(l.block)) byBlock.set(l.block, []);
    byBlock.get(l.block)!.push(l);
  }

  const blocksHtml = Array.from(byBlock.entries())
    .map(([block, lines]) => {
      const rows = lines
        .map(
          (l) => `
        <tr>
          <td>${escapeHtml(l.name)}</td>
          <td>${formatQty(l.qty)}</td>
          <td>${escapeHtml(l.unit)}</td>
          <td>${escapeHtml(l.status)}</td>
          <td class="muted">${escapeHtml(sanitizeFormula(l.formulaExplanation))}</td>
        </tr>`,
        )
        .join("");
      return `
        <h2>${escapeHtml(COMMERCIAL_BLOCK_LABELS[block])}</h2>
        <table>
          <thead><tr><th>Материал/работа</th><th>Кол-во</th><th>Ед.</th><th>Статус</th><th>Пояснение</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    })
    .join("");

  const laborHtml =
    snapshot.laborStages.length > 0
      ? `
      <h2>Человеко-часы</h2>
      <table>
        <thead><tr><th>Этап</th><th>Люди</th><th>Дни</th><th>Часов/день</th><th>Всего часов</th></tr></thead>
        <tbody>
          ${snapshot.laborStages
            .map((s) => `<tr><td>${escapeHtml(s.name)}</td><td>${s.people}</td><td>${s.days}</td><td>${s.hoursPerDay}</td><td>${s.hours}</td></tr>`)
            .join("")}
        </tbody>
      </table>`
      : "";

  const body = `
    <div class="header">
      <div>
        <h1>Производственное задание</h1>
        <div class="muted">Luxury House - Цех</div>
      </div>
      <div style="text-align:right">
        <div>${escapeHtml(meta.objectLabel)}</div>
        <div class="muted">Версия задания: ${meta.revisionVersion}</div>
      </div>
    </div>
    <p><strong>Модель:</strong> ${escapeHtml(snapshot.templateLabel)}, ${escapeHtml(snapshot.pileSummary.variantName)}</p>
    <p class="muted">Свайное поле: ${
      snapshot.pileSummary.totalPiles === null
        ? escapeHtml(snapshot.pileSummary.source)
        : `${snapshot.pileSummary.totalPiles} шт`
    }. Только актуальная выпущенная версия задания.</p>

    ${blocksHtml}
    ${laborHtml}

    <div class="footer-note">
      Документ не содержит цен и не является коммерческой сметой. Для регистрации брака,
      расхода материалов и фактических часов используйте формы учёта в системе.
    </div>
  `;

  return wrapHtmlDocument(`Задание ${meta.projectTitle}`, body);
}
