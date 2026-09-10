"use client";

import { useState } from "react";

function newKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function ShopEntryForms({ revisionId }: { revisionId: string }) {
  return (
    <div className="grid-2">
      <ActualWorkForm revisionId={revisionId} />
      <MaterialMovementForm revisionId={revisionId} />
    </div>
  );
}

function ActualWorkForm({ revisionId }: { revisionId: string }) {
  const [operationKey, setOperationKey] = useState("");
  const [employeeOrBrigade, setEmployeeOrBrigade] = useState("");
  const [hours, setHours] = useState("");
  const [entryMode, setEntryMode] = useState<"PER_PERSON" | "BRIGADE_TOTAL">("BRIGADE_TOTAL");
  const [idempotencyKey, setIdempotencyKey] = useState(newKey());
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/shop/actual-work", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        revisionId,
        operationKey,
        employeeOrBrigade,
        hours: Number(hours),
        entryMode,
        idempotencyKey,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setStatus(data.error ?? "Ошибка");
      return;
    }
    setStatus(data.deduplicated ? "Уже было записано ранее (повтор проигнорирован)" : "Часы записаны");
    setIdempotencyKey(newKey());
    setHours("");
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Фактические часы</h2>
      <form onSubmit={submit}>
        <div className="field">
          <label>Операция</label>
          <input value={operationKey} onChange={(e) => setOperationKey(e.target.value)} required style={{ width: "100%" }} />
        </div>
        <div className="field">
          <label>Сотрудник/бригада</label>
          <input value={employeeOrBrigade} onChange={(e) => setEmployeeOrBrigade(e.target.value)} required style={{ width: "100%" }} />
        </div>
        <div className="field">
          <label>Часы</label>
          <input type="number" step="0.5" min="0" value={hours} onChange={(e) => setHours(e.target.value)} required style={{ width: "100%" }} />
        </div>
        <div className="field">
          <label>Способ ввода</label>
          <select value={entryMode} onChange={(e) => setEntryMode(e.target.value as typeof entryMode)} style={{ width: "100%" }}>
            <option value="BRIGADE_TOTAL">Суммой по бригаде</option>
            <option value="PER_PERSON">За каждого человека</option>
          </select>
        </div>
        <button type="submit" className="primary" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Отправка..." : "Записать часы"}
        </button>
      </form>
      {status && <p className="muted" style={{ marginTop: 10 }}>{status}</p>}
    </div>
  );
}

function MaterialMovementForm({ revisionId }: { revisionId: string }) {
  const [materialName, setMaterialName] = useState("");
  const [direction, setDirection] = useState<"ISSUED" | "RETURNED" | "CONSUMED" | "SHORTAGE">("ISSUED");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("шт");
  const [comment, setComment] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newKey());
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/shop/material-movement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revisionId, materialName, direction, qty: Number(qty), unit, comment, idempotencyKey }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setStatus(data.error ?? "Ошибка");
      return;
    }
    setStatus(data.deduplicated ? "Уже было записано ранее (повтор проигнорирован)" : "Движение материала записано");
    setIdempotencyKey(newKey());
    setQty("");
    setComment("");
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Расход / остаток материала</h2>
      <form onSubmit={submit}>
        <div className="field">
          <label>Материал</label>
          <input value={materialName} onChange={(e) => setMaterialName(e.target.value)} required style={{ width: "100%" }} />
        </div>
        <div className="field">
          <label>Тип движения</label>
          <select value={direction} onChange={(e) => setDirection(e.target.value as typeof direction)} style={{ width: "100%" }}>
            <option value="ISSUED">Выдано</option>
            <option value="CONSUMED">Использовано</option>
            <option value="RETURNED">Возвращено</option>
            <option value="SHORTAGE">Недостача</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Количество</label>
            <input type="number" step="0.01" min="0" value={qty} onChange={(e) => setQty(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Ед.</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} required style={{ width: "100%" }} />
          </div>
        </div>
        <div className="field">
          <label>Комментарий</label>
          <input value={comment} onChange={(e) => setComment(e.target.value)} style={{ width: "100%" }} />
        </div>
        <button type="submit" className="primary" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Отправка..." : "Записать"}
        </button>
      </form>
      {status && <p className="muted" style={{ marginTop: 10 }}>{status}</p>}
    </div>
  );
}
