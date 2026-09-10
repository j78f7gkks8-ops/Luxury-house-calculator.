"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CatalogPicker, CatalogListItem } from "./CatalogPicker";

const APPROVED_TEMPLATES = [
  { id: "barn-96-kyzyl", label: "Барн 96 / Кызыл" },
  { id: "norma-77-v2", label: "Норма 77 V2" },
] as const;

const BARN_96_OPTIONS = [
  { id: "warm-floor", label: "Водяной тёплый пол" },
  { id: "convectors", label: "Резервные конвекторы (6 шт)" },
  { id: "tile-bathroom", label: "Плитка в санузле (душевой угол)" },
  { id: "boiler-room", label: "Пристройка-кочегарка 3x3" },
];

const CATALOG_OPTIONS = [
  { id: "warm-floor", label: "Водяной тёплый пол (по подписанной внутренней площади)" },
  { id: "terrace-decking", label: "Настил террасы (по подписанной площади террасы)" },
  { id: "tile-bathroom", label: "Плитка санузла: душевой угол 1x1 м" },
];

function formatRub(v: number | null | undefined): string {
  if (v === null || v === undefined) return "цена не задана";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
}

interface SnapshotPreview {
  templateLabel: string;
  selectedOptionIds: string[];
  optionConflicts: string[];
  clientDescription: { block: string; title: string; items: string[]; priceRub: number | null }[];
  priceSummary: { roundedPriceRub: number; minimumAllowedPriceRub: number; baseProfitProtected: boolean };
  costSummary: { linesWithMissingPrice: string[] };
  readiness: {
    level: "CATALOG_PRELIMINARY" | "OWNER_APPROVED";
    isFullCost: boolean;
    gaps: string[];
    assumptions: string[];
  };
  catalogRef?: {
    displayName: string;
    advertisedAreaM2: number | null;
    labeledIndoorAreaSumM2: number | null;
    terraceLabeledAreaM2: number | null;
    advertisedVsLabeledDeltaM2: number | null;
    planImagePath: string | null;
    sourceUrl: string;
    issues: { code: string; message: string }[];
  };
  pileSummary: { totalPiles: number | null; variantName: string; source: string };
}

type Source = "catalog" | "approved";

export function NewProjectWizard() {
  const router = useRouter();
  const [source, setSource] = useState<Source>("catalog");
  const [catalog, setCatalog] = useState<CatalogListItem[]>([]);
  const [catalogProjectId, setCatalogProjectId] = useState<string | null>(null);
  const [approvedTemplateId, setApprovedTemplateId] = useState<"barn-96-kyzyl" | "norma-77-v2">("barn-96-kyzyl");
  const [terraceDepthM, setTerraceDepthM] = useState<2 | 3>(2);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [title, setTitle] = useState("");
  const [preview, setPreview] = useState<SnapshotPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((d) => setCatalog(d.projects ?? []))
      .catch(() => setCatalog([]));
  }, []);

  const templateInput =
    source === "catalog"
      ? catalogProjectId
        ? { templateId: "catalog" as const, catalogProjectId, selectedOptionIds }
        : null
      : approvedTemplateId === "barn-96-kyzyl"
        ? { templateId: "barn-96-kyzyl" as const, terraceDepthM, selectedOptionIds }
        : { templateId: "norma-77-v2" as const, selectedOptionIds };

  const templateKey = JSON.stringify(templateInput);

  useEffect(() => {
    if (templateKey === "null") {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    fetch("/api/estimate/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: templateKey,
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
  }, [templateKey]);

  function toggleOption(id: string) {
    setSelectedOptionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function switchSource(next: Source) {
    setSource(next);
    setSelectedOptionIds([]);
    setPreview(null);
  }

  async function handleSave() {
    if (!customerName.trim() || !title.trim()) {
      setErrorMsg("Укажите клиента и название проекта");
      return;
    }
    if (!templateInput) {
      setErrorMsg("Выберите проект");
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

  const options =
    source === "catalog" ? CATALOG_OPTIONS : approvedTemplateId === "barn-96-kyzyl" ? BARN_96_OPTIONS : [];

  return (
    <div className="grid-2">
      <div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>1. Клиент и объект</h2>
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
          <h2 style={{ marginTop: 0 }}>2. Источник данных модели</h2>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              className={source === "catalog" ? "primary" : ""}
              onClick={() => switchSource("catalog")}
            >
              Каталог сайта ({catalog.length})
            </button>
            <button
              type="button"
              className={source === "approved" ? "primary" : ""}
              onClick={() => switchSource("approved")}
            >
              Утверждённая редакция
            </button>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
            {source === "catalog"
              ? "Каталог lhmodul.ru - исходные данные сайта: предварительный расчёт с явным списком недостающих блоков."
              : "Утверждённые владельцем редакции: подтверждённая геометрия, нормы и калибровка часов."}
          </p>

          {source === "catalog" ? (
            <CatalogPicker projects={catalog} selectedId={catalogProjectId} onSelect={setCatalogProjectId} />
          ) : (
            <>
              <div className="field">
                <label>Шаблон</label>
                <select
                  value={approvedTemplateId}
                  onChange={(e) => setApprovedTemplateId(e.target.value as typeof approvedTemplateId)}
                  style={{ width: "100%" }}
                >
                  {APPROVED_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              {approvedTemplateId === "barn-96-kyzyl" && (
                <div className="field">
                  <label>Глубина террасы</label>
                  <select
                    value={terraceDepthM}
                    onChange={(e) => setTerraceDepthM(Number(e.target.value) as 2 | 3)}
                    style={{ width: "100%" }}
                  >
                    <option value={2}>2 м</option>
                    <option value={3}>3 м</option>
                  </select>
                </div>
              )}
            </>
          )}
        </div>

        {options.length > 0 && (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>3. Комплектация и опции</h2>
            {options.map((opt) => (
              <label
                key={opt.id}
                style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }}
              >
                <input type="checkbox" checked={selectedOptionIds.includes(opt.id)} onChange={() => toggleOption(opt.id)} />
                <span style={{ color: "var(--text)" }}>{opt.label}</span>
              </label>
            ))}
            {preview && selectedOptionIds.some((id) => !preview.selectedOptionIds.includes(id)) && (
              <p className="tag warn" style={{ display: "inline-block" }}>
                Часть опций недоступна для этой модели: на плане нет исходных данных
              </p>
            )}
            {preview?.optionConflicts?.map((c, i) => (
              <p key={i} className="tag warn" style={{ display: "block", marginBottom: 4 }}>
                {c}
              </p>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Предложение</h2>
          {loading && <p className="muted">Расчёт...</p>}
          {errorMsg && <p style={{ color: "var(--danger-text)" }}>{errorMsg}</p>}
          {templateKey === "null" && !errorMsg && <p className="muted">Выберите проект слева.</p>}

          {preview && (
            <>
              {!preview.readiness.isFullCost && (
                <p className="tag warn" style={{ display: "block", marginBottom: 12 }}>
                  Предварительная оценка: это не полная себестоимость, часть обязательных блоков не определена.
                </p>
              )}

              <div className="price-box" style={{ marginTop: 0 }}>
                <div className="muted">
                  {preview.readiness.isFullCost ? "Цена предложения" : "Предварительная цена по известным позициям"}
                </div>
                <div style={{ fontSize: 26, fontWeight: 700 }} className="money">
                  {formatRub(preview.priceSummary.roundedPriceRub)}
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Минимально допустимая цена: {formatRub(preview.priceSummary.minimumAllowedPriceRub)}
                </div>
              </div>

              {preview.catalogRef && (
                <div style={{ marginBottom: 12 }}>
                  <div className="section-title">Площади (у каждой своё определение)</div>
                  <table>
                    <tbody>
                      <tr>
                        <td>Площадь сайта</td>
                        <td>{preview.catalogRef.advertisedAreaM2 ?? "не указано"} м²</td>
                      </tr>
                      <tr>
                        <td>Сумма подписей внутри плана</td>
                        <td>{preview.catalogRef.labeledIndoorAreaSumM2 ?? "не указано"} м²</td>
                      </tr>
                      <tr>
                        <td>Терраса по плану</td>
                        <td>{preview.catalogRef.terraceLabeledAreaM2 ?? "не указано"} м²</td>
                      </tr>
                    </tbody>
                  </table>
                  {preview.catalogRef.issues.map((issue, i) => (
                    <p key={i} className="tag warn" style={{ display: "block", marginTop: 6 }}>
                      {issue.message}
                    </p>
                  ))}
                </div>
              )}

              <div className="section-title">Свайное поле</div>
              <p className="muted" style={{ marginTop: 0 }}>
                {preview.pileSummary.totalPiles === null
                  ? preview.pileSummary.source
                  : `${preview.pileSummary.totalPiles} свай (${preview.pileSummary.variantName})`}
              </p>

              {preview.readiness.gaps.length > 0 && (
                <details className="line-detail" style={{ marginBottom: 10 }}>
                  <summary>Не определено: {preview.readiness.gaps.length} позиций</summary>
                  <ul style={{ fontSize: 13 }}>
                    {preview.readiness.gaps.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </details>
              )}

              <details className="line-detail" style={{ marginBottom: 10 }}>
                <summary>Принятые допущения</summary>
                <ul style={{ fontSize: 13 }}>
                  {preview.readiness.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </details>

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

          <button
            className="primary"
            onClick={handleSave}
            disabled={saving || !preview}
            style={{ marginTop: 16, width: "100%" }}
          >
            {saving ? "Сохранение..." : "Сохранить вариант"}
          </button>
        </div>
      </div>
    </div>
  );
}
