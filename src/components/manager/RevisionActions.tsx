"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RevisionActions({ revisionId, status, projectId }: { revisionId: string; status: string; projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function recalculate() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/revisions/${revisionId}/recalculate`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? "Ошибка пересчёта");
      return;
    }
    setMessage(
      `Создана версия ${data.version}. Разница цены: ${data.diff.priceDeltaRub >= 0 ? "+" : ""}${data.diff.priceDeltaRub} ₽`,
    );
    router.refresh();
  }

  async function releaseToProduction() {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/revisions/${revisionId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PRODUCTION_TASK" }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? "Ошибка");
      return;
    }
    setMessage("Задание выпущено в цех");
    router.refresh();
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Версия</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button onClick={recalculate} disabled={busy}>
          Пересчитать по новым ценам (новая версия)
        </button>
        {status === "DRAFT" && (
          <button className="primary" onClick={releaseToProduction} disabled={busy}>
            Выпустить задание в цех
          </button>
        )}
      </div>
      {message && <p className="muted" style={{ marginTop: 10 }}>{message}</p>}
    </div>
  );
}
