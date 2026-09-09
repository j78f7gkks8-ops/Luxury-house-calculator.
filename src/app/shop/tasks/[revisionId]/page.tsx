import { redirect, notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { AppHeader } from "@/components/AppHeader";
import { loadRevisionWithSnapshot } from "@/lib/domain/revisionAccess";
import { redactSnapshotForRole } from "@/lib/domain/rbac";
import { COMMERCIAL_BLOCK_LABELS, CommercialBlock, formatQty } from "@/lib/domain/snapshot";
import { ShopEntryForms } from "@/components/shop/ShopEntryForms";

export const dynamic = "force-dynamic";

const SHOP_VISIBLE_STATUSES = ["PRODUCTION_TASK", "PRODUCTION", "INSTALLATION", "COMPLETED"];

export default async function ShopTaskPage({ params }: { params: { revisionId: string } }) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (session.user.role !== "SHOP" && session.user.role !== "OWNER") redirect("/");

  const loaded = await loadRevisionWithSnapshot(params.revisionId);
  if (!loaded) notFound();
  const { revision, snapshot: fullSnapshot } = loaded;

  if (session.user.role === "SHOP" && !SHOP_VISIBLE_STATUSES.includes(revision.status)) {
    notFound();
  }

  const snapshot = redactSnapshotForRole(fullSnapshot, session.user.role);

  const byBlock = new Map<CommercialBlock, typeof snapshot.compositionLines>();
  for (const l of snapshot.compositionLines) {
    if (!byBlock.has(l.block)) byBlock.set(l.block, []);
    byBlock.get(l.block)!.push(l);
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <h1>
          {revision.variant.project.title} <span className="tag">v{revision.version}</span>
        </h1>
        <p className="muted">
          {snapshot.templateLabel}, {snapshot.pileSummary.variantName}
          {snapshot.pileSummary.totalPiles !== null && ` · ${snapshot.pileSummary.totalPiles} свай`}
        </p>

        <div className="card">
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <a className="btn" href={`/api/exports/${revision.id}?kind=PRODUCTION_PDF`}>
              Задание (PDF, без цен)
            </a>
            <a className="btn" href={`/api/exports/${revision.id}?kind=PRODUCTION_XLSX`}>
              Ведомость (XLSX, без цен)
            </a>
          </div>
        </div>

        {Array.from(byBlock.entries()).map(([block, lines]) => (
          <div className="card" key={block}>
            <h2 style={{ marginTop: 0 }}>{COMMERCIAL_BLOCK_LABELS[block]}</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Материал/работа</th>
                    <th>Кол-во</th>
                    <th>Ед.</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.key}>
                      <td>{l.name}</td>
                      <td>{formatQty(l.qty)}</td>
                      <td>{l.unit}</td>
                      <td>
                        <span className="tag">{l.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {snapshot.laborStages.length > 0 && (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Плановые человеко-часы</h2>
            <table>
              <thead>
                <tr>
                  <th>Этап</th>
                  <th>Люди</th>
                  <th>Дни</th>
                  <th>Часов/день</th>
                  <th>Всего часов</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.laborStages.map((s, i) => (
                  <tr key={i}>
                    <td>{s.name}</td>
                    <td>{s.people}</td>
                    <td>{s.days}</td>
                    <td>{s.hoursPerDay}</td>
                    <td>{s.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2>Учёт факта</h2>
        <ShopEntryForms revisionId={revision.id} />
      </main>
    </div>
  );
}
