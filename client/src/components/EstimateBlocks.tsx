import { useState } from "react";
import type { EstimateBlockView } from "../types";

const STATUS_LABELS: Record<string, string> = {
  confirmed: "подтверждено",
  from_drawing_needs_check: "по чертежу, требует сверки",
  preliminary_by_analog: "предварительно, по аналогу",
  needs_price: "цена уточняется",
  needs_size: "размер уточняется",
  version_conflict: "конфликт версий",
  included_in_package: "включено в пакет",
};

function StatusTag({ status }: { status: string }) {
  const warn = status === "needs_price" || status === "needs_size" || status === "version_conflict";
  return <span className={`status-tag${warn ? " warn" : ""}`}>{STATUS_LABELS[status] ?? status}</span>;
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "нет данных";
  return value.toLocaleString("ru-RU") + " ₽";
}

/**
 * Раздел 2: "в таблицах сначала итоги блоков; раскрытие показывает строки". Компонент
 * работает с любым срезом (владелец/менеджер/цех) — просто не показывает поля, которых нет
 * в переданных данных (amount/unitPrice отсутствуют у менеджера и цеха).
 */
export function EstimateBlocks({ blocks, showMoney }: { blocks: EstimateBlockView[]; showMoney: boolean }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div>
      {blocks.map((block) => (
        <div key={block.id} className="card" style={{ marginBottom: 10, padding: "12px 16px" }}>
          <div className="block-header" onClick={() => setExpanded((e) => ({ ...e, [block.id]: !e[block.id] }))}>
            <strong>
              {block.label} {block.hasGaps && <span className="status-tag warn">есть незаполненные пункты</span>}
            </strong>
            <span>
              {showMoney && block.subtotal !== undefined ? formatMoney(block.subtotal) : ""} {expanded[block.id] ? "▲" : "▼"}
            </span>
          </div>
          {expanded[block.id] && (
            <table className="block-lines">
              <thead>
                <tr>
                  <th>Позиция</th>
                  <th>Кол-во</th>
                  {showMoney && <th>Сумма</th>}
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {block.lines.map((line) => (
                  <tr key={line.id} title={line.note ?? undefined}>
                    <td>{line.label}</td>
                    <td>
                      {line.quantity ?? ""} {line.unit ?? ""}
                    </td>
                    {showMoney && <td>{formatMoney(line.amount)}</td>}
                    <td>
                      <StatusTag status={line.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

export function GapsBanner({ gaps }: { gaps: { code: string; message: string }[] }) {
  if (gaps.length === 0) return null;
  return (
    <div className="gap-banner">
      <strong>Незаполненные пункты ({gaps.length}):</strong>
      <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
        {gaps.map((g) => (
          <li key={g.code}>{g.message}</li>
        ))}
      </ul>
    </div>
  );
}
