import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError, downloadFile } from "../api";
import { EstimateBlocks, GapsBanner } from "../components/EstimateBlocks";
import { VariantForm, defaultVariantFormValue, type VariantFormValue } from "./VariantForm";
import type { AnyEstimateView, CatalogProject, ManagerEstimateView, OwnerEstimateView, ProjectSummary } from "../types";

function toSelection(v: VariantFormValue, family: "BARN" | "NORMA") {
  return {
    catalogTemplateId: "custom",
    family,
    insideAreaM2: v.insideAreaM2,
    closedFootprintM2: v.closedFootprintM2,
    rectFootprint: v.rectFootprint,
    windows: v.windows.map((w) => ({
      id: w.id,
      label: w.label,
      productId: w.productId,
      referenceFinish: "white" as const,
      targetFinish: w.targetFinish,
      widthMm: w.widthMm,
      heightMm: w.heightMm,
      shape: "rect" as const,
      qty: w.qty,
    })),
    options: v.options.map((o) => ({
      id: o.id,
      label: o.label,
      category: "addon" as const,
      priceRub: o.priceRub,
      status: o.priceRub != null ? ("confirmed" as const) : ("needs_price" as const),
    })),
    foundation: {
      template: v.foundationTemplate,
      terraceDepthM: v.terraceDepthM,
      manualPileCount: v.manualPileCount,
    },
    pricing: {
      mode: v.pricingMode,
      markupK: v.markupK,
      targetProfitG: v.targetProfitG,
      targetShareG: v.targetShareG,
      taxRateT: v.taxRateT,
      managerCommissionM: v.managerCommissionM,
      roundingStep: v.roundingStep,
    },
  };
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [catalogEntry, setCatalogEntry] = useState<CatalogProject | null>(null);
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<AnyEstimateView | null>(null);
  const [formValue, setFormValue] = useState<VariantFormValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const p = await api.get<ProjectSummary>(`/projects/${id}`);
    setProject(p);
    const catalog = await api.get<{ projects: CatalogProject[] }>("/catalog/projects");
    const entry = catalog.projects.find((c) => c.id === p.catalogTemplateId) ?? null;
    setCatalogEntry(entry);
    if (!formValue) {
      setFormValue(
        defaultVariantFormValue(
          entry?.insideByExplicationM2 ?? 60,
          entry?.closedFootprintM2 ?? 72,
          entry?.rectFootprint ? { spanM: entry.rectFootprint.spanM, lengthM: entry.rectFootprint.lengthM } : null
        )
      );
    }
    if (p.variants && p.variants.length > 0) {
      const latest = p.variants[p.variants.length - 1];
      setActiveVariantId(latest.id);
      const est = await api.get<{ estimate: AnyEstimateView }>(`/projects/${id}/variants/${latest.id}`);
      setEstimate(est.estimate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof ApiError ? e.message : String(e)));
  }, [load]);

  async function submitVariant() {
    if (!id || !formValue || !project) return;
    setSubmitting(true);
    setError(null);
    try {
      const selection = toSelection(formValue, project.familyType);
      const result = await api.post<{ variant: { id: string }; estimate: AnyEstimateView }>(`/projects/${id}/variants`, {
        label: formValue.label,
        selection,
      });
      setActiveVariantId(result.variant.id);
      setEstimate(result.estimate);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось рассчитать смету");
    } finally {
      setSubmitting(false);
    }
  }

  if (!project || !formValue) return <p>Загрузка...</p>;

  const showMoney = user?.role === "OWNER";
  const isManagerOrOwner = user?.role === "MANAGER" || user?.role === "OWNER";

  return (
    <div>
      <div className="card">
        <h2>{project.name}</h2>
        <p className="muted">
          {project.familyType} · {catalogEntry?.name ?? project.catalogTemplateId} · клиент: {project.customer?.name ?? "—"}
        </p>
        {catalogEntry && (
          <p className="muted">
            Внутри по экспликации: {catalogEntry.insideByExplicationM2} м² · Закрытая часть по контуру: {catalogEntry.closedFootprintM2} м²
          </p>
        )}
      </div>

      {error && <div className="error-banner">{error}</div>}

      {estimate && (
        <div className="card">
          <h3>Расчёт</h3>
          {"pricing" in estimate && (estimate as OwnerEstimateView).fullCostC !== undefined && (
            <div style={{ marginBottom: 12 }}>
              <div className="big-number">{(estimate as OwnerEstimateView).pricing.price.toLocaleString("ru-RU")} ₽</div>
              <p className="muted">
                Себестоимость: {(estimate as OwnerEstimateView).fullCostC.toLocaleString("ru-RU")} ₽ · Прибыль:{" "}
                {(estimate as OwnerEstimateView).pricing.profit.toLocaleString("ru-RU")} ₽ · Наценка:{" "}
                {(estimate as OwnerEstimateView).pricing.markupPct.toFixed(1)}% · Маржа:{" "}
                {(estimate as OwnerEstimateView).pricing.marginAfterCostsPct.toFixed(1)}%
              </p>
            </div>
          )}
          {"clientPrice" in estimate && (
            <div style={{ marginBottom: 12 }}>
              <div className="big-number">{(estimate as ManagerEstimateView).clientPrice.recommendedPrice.toLocaleString("ru-RU")} ₽</div>
              <p className="muted">
                Минимально допустимая цена: {(estimate as ManagerEstimateView).clientPrice.minimumAllowedPrice.toLocaleString("ru-RU")} ₽ (скидка
                до {(estimate as ManagerEstimateView).clientPrice.allowedDiscountPct}% без согласования владельца)
              </p>
            </div>
          )}
          {"gaps" in estimate && <GapsBanner gaps={(estimate as OwnerEstimateView | ManagerEstimateView).gaps} />}
          <EstimateBlocks blocks={estimate.blocks} showMoney={showMoney} />

          <div className="export-buttons">
            {user?.role === "OWNER" && (
              <button className="secondary" onClick={() => downloadFile(`/exports/projects/${id}/variants/${activeVariantId}/owner-xlsx`, "internal-estimate.xlsx")}>
                Скачать внутреннюю смету XLSX
              </button>
            )}
            {isManagerOrOwner && (
              <>
                <button className="secondary" onClick={() => downloadFile(`/exports/projects/${id}/variants/${activeVariantId}/client-pdf`, "quote.pdf")}>
                  Клиентская смета PDF
                </button>
                <button className="secondary" onClick={() => downloadFile(`/exports/projects/${id}/variants/${activeVariantId}/client-docx`, "quote.docx")}>
                  Клиентская смета DOCX
                </button>
              </>
            )}
            {(user?.role === "WORKSHOP" || user?.role === "OWNER") && (
              <button className="secondary" onClick={() => downloadFile(`/exports/projects/${id}/variants/${activeVariantId}/production-xlsx`, "production.xlsx")}>
                Производственное задание XLSX
              </button>
            )}
          </div>
        </div>
      )}

      {isManagerOrOwner && <VariantForm value={formValue} onChange={setFormValue} onSubmit={submitVariant} submitting={submitting} />}

      {user?.role === "WORKSHOP" && activeVariantId && <ActualWorkForm projectId={id!} />}
    </div>
  );
}

function ActualWorkForm({ projectId }: { projectId: string }) {
  const [operation, setOperation] = useState("");
  const [employee, setEmployee] = useState("");
  const [hours, setHours] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setSaved(null);
    try {
      await api.post("/actual-work", {
        projectId,
        operation,
        employeeOrCrew: employee,
        entryMode: "per_person",
        actualHours: Number(hours),
        date: new Date().toISOString(),
        idempotencyKey: crypto.randomUUID(),
      });
      setSaved("Запись сохранена");
      setOperation("");
      setEmployee("");
      setHours("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Не удалось сохранить");
    }
  }

  return (
    <div className="card">
      <h3>Учёт факта (план/факт)</h3>
      <div className="grid-2">
        <div className="field">
          <label>Операция</label>
          <input value={operation} onChange={(e) => setOperation(e.target.value)} />
        </div>
        <div className="field">
          <label>Сотрудник/бригада</label>
          <input value={employee} onChange={(e) => setEmployee(e.target.value)} />
        </div>
        <div className="field">
          <label>Фактические часы</label>
          <input type="number" value={hours} onChange={(e) => setHours(e.target.value)} />
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {saved && <p className="muted">{saved}</p>}
      <button onClick={submit}>Сохранить запись</button>
    </div>
  );
}
