import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/AppHeader";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PRELIMINARY_OFFER: "Предварительное предложение",
  AGREED_OFFER: "Согласованное предложение",
  CONTRACT_CONFIG: "Договорная комплектация",
  PRODUCTION_TASK: "Задание в цех",
  PRODUCTION: "Производство",
  INSTALLATION: "Монтаж",
  COMPLETED: "Завершено",
};

export default async function ManagerHomePage() {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (session.user.role !== "MANAGER" && session.user.role !== "OWNER") redirect("/");

  const where = session.user.role === "OWNER" ? {} : { createdByUserId: session.user.id };
  const projects = await prisma.project.findMany({
    where,
    include: {
      customer: true,
      variants: { include: { revisions: { orderBy: { version: "desc" }, take: 1 } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1>Проекты менеджера</h1>
          <Link href="/manager/new" className="btn primary">
            + Новый проект
          </Link>
        </div>

        <div className="card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Проект</th>
                  <th>Последняя версия</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const latestRevision = p.variants[0]?.revisions[0];
                  return (
                    <tr key={p.id}>
                      <td>{p.customer.name}</td>
                      <td>{p.title}</td>
                      <td>{latestRevision ? `v${latestRevision.version}` : "—"}</td>
                      <td>{latestRevision ? STATUS_LABELS[latestRevision.status] ?? latestRevision.status : "—"}</td>
                      <td>
                        {latestRevision && <Link href={`/manager/projects/${p.id}`}>Открыть</Link>}
                      </td>
                    </tr>
                  );
                })}
                {projects.length === 0 && (
                  <tr>
                    <td colSpan={5} className="muted">
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
