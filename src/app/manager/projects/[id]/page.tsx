import { redirect, notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/AppHeader";
import { redactSnapshotForRole } from "@/lib/domain/rbac";
import { EstimateSnapshot, COMMERCIAL_BLOCK_LABELS } from "@/lib/domain/snapshot";
import { RevisionActions } from "@/components/manager/RevisionActions";

export const dynamic = "force-dynamic";

function formatRub(v: number | null): string {
  if (v === null) return "цена не задана";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(v) + " ₽";
}

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (session.user.role !== "MANAGER" && session.user.role !== "OWNER") redirect("/");

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      variants: { include: { revisions: { orderBy: { version: "desc" } } } },
    },
  });
  if (!project) notFound();
  if (session.user.role === "MANAGER" && project.createdByUserId !== session.user.id) redirect("/manager");

  const latestRevision = project.variants[0]?.revisions[0];
  if (!latestRevision) notFound();

  const fullSnapshot = JSON.parse(latestRevision.snapshotJson) as EstimateSnapshot;
  const snapshot = redactSnapshotForRole(fullSnapshot, session.user.role);

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <h1>
          {project.title} <span className="tag">v{latestRevision.version}</span>
        </h1>
        <p className="muted">
          Клиент: {project.customer.name} · Статус: {latestRevision.status}
        </p>

        {!snapshot.readiness.isFullCost && (
          <p className="tag warn" style={{ display: "inline-block" }}>
            Предварительная оценка: не полная себестоимость, {snapshot.readiness.gaps.length} позиций не определено
          </p>
        )}

        <div className="grid-2">
          <div>
            <div className="price-box">
              <div className="muted">
                {snapshot.readiness.isFullCost ? "Цена предложения" : "Предварительная цена по известным позициям"}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700 }} className="money">
                {formatRub(snapshot.priceSummary.roundedPriceRub)}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Мин. допустимая цена: {formatRub(snapshot.priceSummary.minimumAllowedPriceRub)}
              </div>
            </div>

            {snapshot.clientDescription.map((block) => (
              <details key={block.block} className="card line-detail">
                <summary>
                  {COMMERCIAL_BLOCK_LABELS[block.block]} — {formatRub(block.priceRub)}
                </summary>
                <ul>
                  {block.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </details>
            ))}
          </div>

          <div>
            {snapshot.catalogRef && (
              <div className="card">
                <h2 style={{ marginTop: 0 }}>Модель и источник данных</h2>
                <p style={{ marginTop: 0 }}>
                  <strong>{snapshot.catalogRef.displayName}</strong>
                  {snapshot.catalogRef.nameAliases.length > 0 && (
                    <span className="muted"> (также: {snapshot.catalogRef.nameAliases.join(", ")})</span>
                  )}
                </p>
                {snapshot.catalogRef.planImagePath && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={snapshot.catalogRef.planImagePath}
                    alt={`Планировка ${snapshot.catalogRef.displayName}`}
                    style={{ width: "100%", borderRadius: 8, background: "var(--bg)" }}
                  />
                )}
                <table>
                  <tbody>
                    <tr>
                      <td>Площадь сайта</td>
                      <td>{snapshot.catalogRef.advertisedAreaM2 ?? "не указано"} м²</td>
                    </tr>
                    <tr>
                      <td>Сумма подписей внутри плана</td>
                      <td>{snapshot.catalogRef.labeledIndoorAreaSumM2 ?? "не указано"} м²</td>
                    </tr>
                    <tr>
                      <td>Терраса по плану</td>
                      <td>{snapshot.catalogRef.terraceLabeledAreaM2 ?? "не указано"} м²</td>
                    </tr>
                    <tr>
                      <td>Высота потолка (карточка)</td>
                      <td>{snapshot.catalogRef.ceilingHeightM ?? "не указано"} м</td>
                    </tr>
                  </tbody>
                </table>
                {session.user.role === "OWNER" && (
                  <p className="muted" style={{ fontSize: 12 }}>
                    Источник: <a href={snapshot.catalogRef.sourceUrl}>{snapshot.catalogRef.sourceUrl}</a> · статус
                    плана: {snapshot.catalogRef.planReviewStatus}
                  </p>
                )}
                {snapshot.catalogRef.issues.map((issue, i) => (
                  <p key={i} className="tag warn" style={{ display: "block", marginTop: 6 }}>
                    {issue.message}
                  </p>
                ))}
              </div>
            )}

            {session.user.role === "OWNER" && snapshot.readiness.gaps.length > 0 && (
              <div className="card">
                <h2 style={{ marginTop: 0 }}>Неполные данные ({snapshot.readiness.gaps.length})</h2>
                <ul style={{ fontSize: 13, marginTop: 0 }}>
                  {snapshot.readiness.gaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
                <div className="section-title">Принятые допущения</div>
                <ul style={{ fontSize: 13, marginTop: 0 }}>
                  {snapshot.readiness.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            {session.user.role === "OWNER" && (
              <div className="card">
                <h2 style={{ marginTop: 0 }}>Экономика (только владелец)</h2>
                <table>
                  <tbody>
                    <tr>
                      <td>Прямые затраты D</td>
                      <td className="money">{formatRub(snapshot.costSummary.directCostsRub)}</td>
                    </tr>
                    <tr>
                      <td>Резерв R ({(snapshot.costSummary.reserveFraction * 100).toFixed(1)}%)</td>
                      <td className="money">{formatRub(snapshot.costSummary.reserveRub)}</td>
                    </tr>
                    <tr>
                      <td>Накладные + амортизация O</td>
                      <td className="money">{formatRub(snapshot.costSummary.overheadRub)}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Полная себестоимость C</strong>
                      </td>
                      <td className="money">
                        <strong>{formatRub(snapshot.costSummary.fullCostRub)}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Налог</td>
                      <td className="money">{formatRub(snapshot.priceSummary.taxRub)}</td>
                    </tr>
                    <tr>
                      <td>Комиссия менеджера</td>
                      <td className="money">{formatRub(snapshot.priceSummary.commissionRub)}</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Прибыль</strong>
                      </td>
                      <td className="money">
                        <strong>{formatRub(snapshot.priceSummary.profitRub)}</strong>
                      </td>
                    </tr>
                    <tr>
                      <td>Наценка / Маржа</td>
                      <td className="money">
                        {(snapshot.priceSummary.markup * 100).toFixed(1)}% / {(snapshot.priceSummary.marginAfterTaxCommission * 100).toFixed(1)}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className="card">
              <h2 style={{ marginTop: 0 }}>Экспорт</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a className="btn" href={`/api/exports/${latestRevision.id}?kind=CLIENT_PDF`}>
                  Клиентское предложение (PDF)
                </a>
                <a className="btn" href={`/api/exports/${latestRevision.id}?kind=CLIENT_DOCX`}>
                  Клиентское предложение (DOCX)
                </a>
                {session.user.role === "OWNER" && (
                  <a className="btn" href={`/api/exports/${latestRevision.id}?kind=OWNER_XLSX`}>
                    Внутренняя смета (XLSX)
                  </a>
                )}
              </div>
            </div>

            <RevisionActions revisionId={latestRevision.id} status={latestRevision.status} projectId={project.id} />
          </div>
        </div>
      </main>
    </div>
  );
}
