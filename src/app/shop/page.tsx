import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/AppHeader";

export const dynamic = "force-dynamic";

const SHOP_VISIBLE_STATUSES = ["PRODUCTION_TASK", "PRODUCTION", "INSTALLATION", "COMPLETED"];

export default async function ShopHomePage() {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (session.user.role !== "SHOP" && session.user.role !== "OWNER") redirect("/");

  const revisions = await prisma.estimateRevision.findMany({
    where: { status: { in: SHOP_VISIBLE_STATUSES } },
    include: { variant: { include: { project: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Only the latest released revision per variant is the "current" task.
  const latestPerVariant = new Map<string, (typeof revisions)[number]>();
  for (const r of revisions) {
    const existing = latestPerVariant.get(r.variantId);
    if (!existing || r.version > existing.version) latestPerVariant.set(r.variantId, r);
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <h1>Производственные задания</h1>
        <div className="card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Объект</th>
                  <th>Версия</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {Array.from(latestPerVariant.values()).map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.variant.project.title} ({r.variant.name})
                    </td>
                    <td>v{r.version}</td>
                    <td>{r.status}</td>
                    <td>
                      <Link href={`/shop/tasks/${r.id}`}>Открыть</Link>
                    </td>
                  </tr>
                ))}
                {latestPerVariant.size === 0 && (
                  <tr>
                    <td colSpan={4} className="muted">
                      Заданий пока нет
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
