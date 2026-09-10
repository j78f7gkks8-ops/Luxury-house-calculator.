import type { WindowRow } from "../pages/VariantForm";

/**
 * Раздел 11.8: "отдельная удобная панель «Остекление» с планом/фасадом". Реальных координат
 * проёмов на фасаде у нас нет (не загружен рабочий чертёж этой планировки) — схема просто
 * ставит выбранные окна в ряд на общей "стене" в масштабе их реальных размеров, чтобы дать
 * наглядное представление о наборе остекления, а не точное расположение на фасаде.
 */
const FINISH_COLOR: Record<WindowRow["targetFinish"], string> = {
  white: "#eef2ee",
  outside: "#3f7a5a",
  both: "#274d3a",
};
const FINISH_LABEL: Record<WindowRow["targetFinish"], string> = {
  white: "белое",
  outside: "антрацит снаружи",
  both: "антрацит с двух сторон",
};

export function FacadeSchematic({ windows }: { windows: WindowRow[] }) {
  if (windows.length === 0) {
    return <p className="muted">Добавьте окна выше, чтобы увидеть схему набора остекления.</p>;
  }

  const gapMm = 300;
  const groundMarginMm = 400;
  const maxHeightMm = Math.max(...windows.map((w) => w.heightMm), 2000);
  const vbH = maxHeightMm + groundMarginMm + 260;
  const totalWidthMm = windows.reduce((acc, w) => acc + w.widthMm + gapMm, gapMm);

  let x = gapMm;
  const groundY = vbH - groundMarginMm;
  const fontSize = Math.max(90, totalWidthMm * 0.018);

  return (
    <div>
      <svg
        viewBox={`0 0 ${totalWidthMm} ${vbH}`}
        style={{ width: "100%", maxWidth: 640, background: "#f7f7f5", border: "1px solid #e3e2de", borderRadius: 8 }}
      >
        <line x1={0} y1={groundY} x2={totalWidthMm} y2={groundY} stroke="#b7c4bb" strokeWidth={totalWidthMm * 0.004} />
        {windows.map((w) => {
          const rectX = x;
          const rectY = groundY - w.heightMm;
          x += w.widthMm + gapMm;
          return (
            <g key={w.id}>
              <rect
                x={rectX}
                y={rectY}
                width={w.widthMm}
                height={w.heightMm}
                fill={FINISH_COLOR[w.targetFinish]}
                stroke="#23241f"
                strokeWidth={totalWidthMm * 0.0025}
              />
              <text x={rectX + w.widthMm / 2} y={rectY - fontSize * 0.6} textAnchor="middle" fontSize={fontSize} fill="#23241f">
                {w.productId} ×{w.qty}
              </text>
              <text x={rectX + w.widthMm / 2} y={rectY + w.heightMm / 2} textAnchor="middle" fontSize={fontSize * 0.8} fill="#23241f">
                {w.widthMm}×{w.heightMm}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
        {(Object.keys(FINISH_COLOR) as WindowRow["targetFinish"][]).map((f) => (
          <span key={f} className="muted" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <span style={{ width: 14, height: 14, background: FINISH_COLOR[f], border: "1px solid #23241f", display: "inline-block" }} />
            {FINISH_LABEL[f]}
          </span>
        ))}
      </div>
      <p className="muted">Иллюстративная схема набора окон в масштабе реальных размеров — не привязка к точным координатам фасада.</p>
    </div>
  );
}
