import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/AppHeader";
import { EstimateSnapshot } from "@/lib/domain/snapshot";

export const dynamic = "force-dynamic";

function formatRub(v: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
}

export default async function OwnerHomePage() {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (session.user.role !== "OWNER") redirect("/");

  const projects = await prisma.project.findMany({
    include: {
      customer: true,
      variants: { include: { revisions: { orderBy: { version: "desc" }, take: 1 } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = projects.map((p) => {
    const revision = p.variants[0]?.revisions[0];
    const snapshot = revision ? (JSON.parse(revision.snapshotJson) as EstimateSnapshot) : null;
    return { project: p, revision, snapshot };
  });

  const activeCount = rows.filter((r) => r.revision && r.revision.status !== "COMPLETED").length;
  const totalPlannedRevenue = rows.reduce((s, r) => s + (r.snapshot?.priceSummary.roundedPriceRub ?? 0), 0);
  const totalPlannedProfit = rows.reduce((s, r) => s + (r.snapshot?.priceSummary.profitRub ?? 0), 0);
  const projectsWithGaps = rows.filter((r) => (r.snapshot?.costSummary.linesWithMissingPrice.length ?? 0) > 0).length;
  const baseUnprotected = rows.filter((r) => r.snapshot && !r.snapshot.priceSummary.baseProfitProtected).length;

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <h1>Обзор бизнеса</h1>

        <div className="kpi-row">
          <div className="kpi">
            <div className="label">Активные дома</div>
            <div className="value">{activeCount}</div>
          </div>
          <div className="kpi">
            <div className="label">Плановая выручка</div>
            <div className="value money">{formatRub(totalPlannedRevenue)}</div>
          </div>
          <div className="kpi">
            <div className="label">Плановая прибыль</div>
            <div className="value money">{formatRub(totalPlannedProfit)}</div>
          </div>
          <div className="kpi">
            <div className="label">Проекты с незаполненными позициями</div>
            <div className="value">{projectsWithGaps}</div>
          </div>
          {baseUnprotected > 0 && (
            <div className="kpi">
              <div className="label">Базовая комплектация не защищена</div>
              <div className="value" style={{ color: "var(--danger-text)" }}>
                {baseUnprotected}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <Link className="btn" href="/manager/new">
            + Новый проект
          </Link>
          <Link className="btn" href="/manager">
            Все проекты (вид менеджера)
          </Link>
          <Link className="btn" href="/shop">
            Производство (вид цеха)
          </Link>
          <Link className="btn" href="/owner/settings">
            Настройки
          </Link>
        </div>

        <div className="card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Проект</th>
                  <th>Версия</th>
                  <th>Статус</th>
                  <th>Себестоимость</th>
                  <th>Цена</th>
                  <th>Прибыль</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ project, revision, snapshot }) => (
                  <tr key={project.id}>
                    <td>{project.customer.name}</td>
                    <td>{project.title}</td>
                    <td>{revision ? `v${revision.version}` : "—"}</td>
                    <td>{revision?.status ?? "—"}</td>
                    <td className="money">{snapshot ? formatRub(snapshot.costSummary.fullCostRub) : "—"}</td>
                    <td className="money">{snapshot ? formatRub(snapshot.priceSummary.roundedPriceRub) : "—"}</td>
                    <td className="money">{snapshot ? formatRub(snapshot.priceSummary.profitRub) : "—"}</td>
                    <td>{revision && <Link href={`/manager/projects/${project.id}`}>Открыть</Link>}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="muted">
                      Проектов пока нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
