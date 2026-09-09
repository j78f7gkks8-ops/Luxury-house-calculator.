"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BARN_OPTIONS = [
  { id: "warm-floor", label: "Водяной тёплый пол" },
  { id: "convectors", label: "Резервные конвекторы (6 шт)" },
  { id: "tile-bathroom", label: "Плитка в санузле (душевой угол)" },
  { id: "boiler-room", label: "Пристройка-кочегарка 3x3" },
];

function formatRub(v: number | null | undefined): string {
  if (v === null || v === undefined) return "цена не задана";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
}

interface ClientDescriptionBlock {
  block: string;
  title: string;
  items: string[];
  priceRub: number | null;
}

interface CompositionLine {
  key: string;
  name: string;
  qty: number;
  unit: string;
  status: string;
  block: string;
}

interface SnapshotPreview {
  templateLabel: string;
  selectedOptionIds: string[];
  optionConflicts: string[];
  clientDescription: ClientDescriptionBlock[];
  compositionLines: CompositionLine[];
  priceSummary: { roundedPriceRub: number; minimumAllowedPriceRub: number; baseProfitProtected: boolean };
  costSummary: { linesWithMissingPrice: string[] };
  pileSummary: { totalPiles: number; variantName: string };
}

export function NewProjectWizard() {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<"barn-96-kyzyl" | "norma-77-v2">("barn-96-kyzyl");
  const [terraceDepthM, setTerraceDepthM] = useState<2 | 3>(2);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [title, setTitle] = useState("");
  const [preview, setPreview] = useState<SnapshotPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const templateInput =
    templateId === "barn-96-kyzyl"
      ? { templateId, terraceDepthM, selectedOptionIds }
      : { templateId, selectedOptionIds: [] };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    fetch("/api/estimate/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(templateInput),
    })
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setErrorMsg(data.error ?? "Ошибка расчёта");
          setPreview(null);
        } else {
          setPreview(data.snapshot);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, terraceDepthM, JSON.stringify(selectedOptionIds)]);

  function toggleOption(id: string) {
    setSelectedOptionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    if (!customerName.trim() || !title.trim()) {
      setErrorMsg("Укажите клиента и название проекта");
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerName, title, templateInput }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setErrorMsg(data.error ?? "Ошибка сохранения");
      return;
    }
    router.push(`/manager/projects/${data.projectId}`);
  }

  return (
    <div className="grid-2">
      <div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>1. Клиент и проект</h2>
          <div className="field">
            <label>Клиент</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} style={{ width: "100%" }} />
          </div>
          <div className="field">
            <label>Название проекта/объекта</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%" }} />
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>2. Модель</h2>
          <div className="field">
            <label>Семейство / шаблон</label>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value as typeof templateId)} style={{ width: "100%" }}>
              <option value="barn-96-kyzyl">Барн 96 / Кызыл</option>
              <option value="norma-77-v2">Норма 77 V2</option>
            </select>
          </div>
          {templateId === "barn-96-kyzyl" && (
            <div className="field">
              <label>Глубина террасы</label>
              <select value={terraceDepthM} onChange={(e) => setTerraceDepthM(Number(e.target.value) as 2 | 3)} style={{ width: "100%" }}>
                <option value={2}>2 м</option>
                <option value={3}>3 м</option>
              </select>
            </div>
          )}
        </div>

        {templateId === "barn-96-kyzyl" && (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>3. Комплектация и опции</h2>
            {BARN_OPTIONS.map((opt) => (
              <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={selectedOptionIds.includes(opt.id)} onChange={() => toggleOption(opt.id)} />
                <span style={{ color: "var(--text)" }}>{opt.label}</span>
              </label>
            ))}
            {preview?.optionConflicts && preview.optionConflicts.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {preview.optionConflicts.map((c, i) => (
                  <p key={i} className="tag warn" style={{ display: "block", marginBottom: 4 }}>
                    {c}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Предложение</h2>
          {loading && <p className="muted">Расчёт...</p>}
          {errorMsg && <p style={{ color: "var(--danger-text)" }}>{errorMsg}</p>}
          {preview && (
            <>
              <div className="price-box" style={{ marginTop: 0 }}>
                <div className="muted">Цена предложения</div>
                <div style={{ fontSize: 26, fontWeight: 700 }} className="money">
                  {formatRub(preview.priceSummary.roundedPriceRub)}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Минимально допустимая цена: {formatRub(preview.priceSummary.minimumAllowedPriceRub)}
                </div>
                {!preview.priceSummary.baseProfitProtected && (
                  <span className="tag danger" style={{ marginTop: 6, display: "inline-block" }}>
                    Базовая комплектация не защищена по прибыли
                  </span>
                )}
              </div>

              {preview.costSummary.linesWithMissingPrice.length > 0 && (
                <p className="tag warn" style={{ display: "inline-block", marginBottom: 12 }}>
                  {preview.costSummary.linesWithMissingPrice.length} позиций ожидают цены
                </p>
              )}

              <p className="muted">
                {preview.pileSummary.totalPiles} свай, {preview.pileSummary.variantName}
              </p>

              {preview.clientDescription.map((block) => (
                <details key={block.block} className="line-detail" style={{ marginBottom: 8 }}>
                  <summary>
                    {block.title} — {formatRub(block.priceRub)}
                  </summary>
                  <ul style={{ fontSize: 13 }}>
                    {block.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </details>
              ))}
            </>
          )}

          <button className="primary" onClick={handleSave} disabled={saving || !preview} style={{ marginTop: 16, width: "100%" }}>
            {saving ? "Сохранение..." : "Сохранить вариант"}
          </button>
        </div>
      </div>
    </div>
  );
}
