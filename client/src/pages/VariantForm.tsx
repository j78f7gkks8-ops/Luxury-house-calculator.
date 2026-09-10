import { useState } from "react";

export interface WindowRow {
  id: string;
  label: string;
  productId: "W1" | "W2" | "W3" | "W4" | "D1";
  targetFinish: "white" | "outside" | "both";
  widthMm: number;
  heightMm: number;
  qty: number;
}

const REFERENCE_SIZES: Record<WindowRow["productId"], { widthMm: number; heightMm: number; label: string }> = {
  W1: { widthMm: 2100, heightMm: 2200, label: "Окно 2100×2200 (три секции)" },
  W2: { widthMm: 1500, heightMm: 1500, label: "Окно 1500×1500 (две секции)" },
  W3: { widthMm: 1200, heightMm: 2200, label: "Окно 1200×2200 (глухое)" },
  W4: { widthMm: 700, heightMm: 1500, label: "Окно 700×1500 (открывающееся)" },
  D1: { widthMm: 1000, heightMm: 2100, label: "Входная остеклённая дверь" },
};

export interface OptionRow {
  id: string;
  label: string;
  priceRub: number | null;
}

export interface VariantFormValue {
  label: string;
  insideAreaM2: number;
  closedFootprintM2: number;
  windows: WindowRow[];
  options: OptionRow[];
  foundationTemplate: "barn96_kyzyl" | "norma77" | "generic_analog" | "manual";
  terraceDepthM: number;
  manualPileCount: number;
  pricingMode: "markup" | "target_profit_absolute" | "target_profit_share";
  markupK: number;
  targetProfitG: number;
  targetShareG: number;
  taxRateT: number;
  managerCommissionM: number;
  roundingStep: number;
}

export function defaultVariantFormValue(insideAreaM2: number, closedFootprintM2: number): VariantFormValue {
  return {
    label: "Вариант 1",
    insideAreaM2,
    closedFootprintM2,
    windows: [],
    options: [
      { id: "toilet", label: "Унитаз стандарт с установкой", priceRub: 30000 },
      { id: "boiler", label: "Бойлер 100 л", priceRub: 30000 },
    ],
    foundationTemplate: "generic_analog",
    terraceDepthM: 3,
    manualPileCount: 25,
    pricingMode: "target_profit_absolute",
    markupK: 0.3,
    targetProfitG: 1500000,
    targetShareG: 0.15,
    taxRateT: 0.06,
    managerCommissionM: 0.02,
    roundingStep: 50000,
  };
}

/** Раздел 4: "выбрать остекление, отопление и комплектацию" — упрощённый, но реальный конструктор выбора. */
export function VariantForm({
  value,
  onChange,
  onSubmit,
  submitting,
}: {
  value: VariantFormValue;
  onChange: (v: VariantFormValue) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [newOptionPrice, setNewOptionPrice] = useState("");

  function addWindow(productId: WindowRow["productId"]) {
    const ref = REFERENCE_SIZES[productId];
    onChange({
      ...value,
      windows: [
        ...value.windows,
        { id: crypto.randomUUID(), label: ref.label, productId, targetFinish: "white", widthMm: ref.widthMm, heightMm: ref.heightMm, qty: 1 },
      ],
    });
  }

  function updateWindow(id: string, patch: Partial<WindowRow>) {
    onChange({ ...value, windows: value.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
  }

  function removeWindow(id: string) {
    onChange({ ...value, windows: value.windows.filter((w) => w.id !== id) });
  }

  function addOption() {
    if (!newOptionLabel.trim()) return;
    onChange({
      ...value,
      options: [...value.options, { id: crypto.randomUUID(), label: newOptionLabel, priceRub: newOptionPrice ? Number(newOptionPrice) : null }],
    });
    setNewOptionLabel("");
    setNewOptionPrice("");
  }

  function removeOption(id: string) {
    onChange({ ...value, options: value.options.filter((o) => o.id !== id) });
  }

  return (
    <div className="card">
      <h3>Комплектация варианта</h3>
      <div className="field">
        <label>Название варианта</label>
        <input value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} />
      </div>

      <h4>Остекление (раздел 11)</h4>
      <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
        {(Object.keys(REFERENCE_SIZES) as WindowRow["productId"][]).map((id) => (
          <button type="button" key={id} className="secondary" onClick={() => addWindow(id)}>
            + {id}
          </button>
        ))}
      </div>
      {value.windows.length > 0 && (
        <table style={{ marginBottom: 12 }}>
          <thead>
            <tr>
              <th>Изделие</th>
              <th>Ширина, мм</th>
              <th>Высота, мм</th>
              <th>Исполнение</th>
              <th>Кол-во</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {value.windows.map((w) => (
              <tr key={w.id}>
                <td>{w.label}</td>
                <td>
                  <input type="number" value={w.widthMm} onChange={(e) => updateWindow(w.id, { widthMm: Number(e.target.value) })} />
                </td>
                <td>
                  <input type="number" value={w.heightMm} onChange={(e) => updateWindow(w.id, { heightMm: Number(e.target.value) })} />
                </td>
                <td>
                  <select value={w.targetFinish} onChange={(e) => updateWindow(w.id, { targetFinish: e.target.value as WindowRow["targetFinish"] })}>
                    <option value="white">Белое</option>
                    <option value="outside">Антрацит снаружи</option>
                    <option value="both">Антрацит с двух сторон</option>
                  </select>
                </td>
                <td>
                  <input type="number" min={1} value={w.qty} onChange={(e) => updateWindow(w.id, { qty: Number(e.target.value) })} />
                </td>
                <td>
                  <button type="button" className="secondary" onClick={() => removeWindow(w.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted">Изменение ширины/высоты относительно эталона запускает предварительную оценку по формуле раздела 11.3.2.</p>

      <h4>Опции и внутренняя отделка (раздел 19)</h4>
      <table style={{ marginBottom: 8 }}>
        <thead>
          <tr>
            <th>Опция</th>
            <th>Цена, ₽</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {value.options.map((o) => (
            <tr key={o.id}>
              <td>{o.label}</td>
              <td>
                {o.priceRub != null ? o.priceRub.toLocaleString("ru-RU") : <span className="status-tag warn">цена не задана</span>}
              </td>
              <td>
                <button type="button" className="secondary" onClick={() => removeOption(o.id)}>
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="Название опции" value={newOptionLabel} onChange={(e) => setNewOptionLabel(e.target.value)} />
        <input placeholder="Цена, ₽ (пусто = не задана)" type="number" value={newOptionPrice} onChange={(e) => setNewOptionPrice(e.target.value)} />
        <button type="button" className="secondary" onClick={addOption}>
          Добавить
        </button>
      </div>

      <h4 style={{ marginTop: 20 }}>Фундамент (раздел 8)</h4>
      <div className="grid-2">
        <div className="field">
          <label>Схема</label>
          <select value={value.foundationTemplate} onChange={(e) => onChange({ ...value, foundationTemplate: e.target.value as VariantFormValue["foundationTemplate"] })}>
            <option value="barn96_kyzyl">Барн 96 / Кызыл (точная сетка 5×5)</option>
            <option value="norma77">Норма 77 (точная сетка 6×4)</option>
            <option value="generic_analog">Оценка по аналогу (для новой планировки)</option>
            <option value="manual">Ручное количество</option>
          </select>
        </div>
        {value.foundationTemplate === "barn96_kyzyl" && (
          <div className="field">
            <label>Глубина террасы, м</label>
            <input type="number" value={value.terraceDepthM} onChange={(e) => onChange({ ...value, terraceDepthM: Number(e.target.value) })} />
          </div>
        )}
        {value.foundationTemplate === "manual" && (
          <div className="field">
            <label>Количество свай (обоснование заносится отдельно)</label>
            <input type="number" value={value.manualPileCount} onChange={(e) => onChange({ ...value, manualPileCount: Number(e.target.value) })} />
          </div>
        )}
      </div>

      <h4 style={{ marginTop: 20 }}>Ценообразование (раздел 18)</h4>
      <div className="grid-2">
        <div className="field">
          <label>Режим цены</label>
          <select value={value.pricingMode} onChange={(e) => onChange({ ...value, pricingMode: e.target.value as VariantFormValue["pricingMode"] })}>
            <option value="markup">Наценка к полной себестоимости</option>
            <option value="target_profit_absolute">Целевая прибыль в рублях</option>
            <option value="target_profit_share">Целевая доля прибыли в цене</option>
          </select>
        </div>
        {value.pricingMode === "markup" && (
          <div className="field">
            <label>Наценка, доля (0.3 = 30%)</label>
            <input type="number" step="0.01" value={value.markupK} onChange={(e) => onChange({ ...value, markupK: Number(e.target.value) })} />
          </div>
        )}
        {value.pricingMode === "target_profit_absolute" && (
          <div className="field">
            <label>Целевая прибыль, ₽</label>
            <input type="number" value={value.targetProfitG} onChange={(e) => onChange({ ...value, targetProfitG: Number(e.target.value) })} />
          </div>
        )}
        {value.pricingMode === "target_profit_share" && (
          <div className="field">
            <label>Целевая доля прибыли (0.15 = 15%)</label>
            <input type="number" step="0.01" value={value.targetShareG} onChange={(e) => onChange({ ...value, targetShareG: Number(e.target.value) })} />
          </div>
        )}
        <div className="field">
          <label>Налог, доля от цены</label>
          <input type="number" step="0.01" value={value.taxRateT} onChange={(e) => onChange({ ...value, taxRateT: Number(e.target.value) })} />
        </div>
        <div className="field">
          <label>Комиссия менеджера, доля от цены</label>
          <input type="number" step="0.01" value={value.managerCommissionM} onChange={(e) => onChange({ ...value, managerCommissionM: Number(e.target.value) })} />
        </div>
        <div className="field">
          <label>Шаг округления цены, ₽</label>
          <input type="number" value={value.roundingStep} onChange={(e) => onChange({ ...value, roundingStep: Number(e.target.value) })} />
        </div>
      </div>

      <button onClick={onSubmit} disabled={submitting} style={{ marginTop: 12 }}>
        {submitting ? "Расчёт..." : "Рассчитать и сохранить версию"}
      </button>
    </div>
  );
}
