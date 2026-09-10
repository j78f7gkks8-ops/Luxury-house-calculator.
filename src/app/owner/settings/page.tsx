import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/AppHeader";
import { OVERHEAD_STARTING_POLICY, REFERENCE_PRICES } from "@/lib/domain/referenceData";

export const dynamic = "force-dynamic";

export default async function OwnerSettingsPage() {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (session.user.role !== "OWNER") redirect("/");

  const policy = await prisma.pricingPolicy.findFirst({ where: { isActive: true } });
  const materials = await prisma.material.findMany({ orderBy: { name: "asc" } });
  const workNorms = await prisma.workNorm.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <h1>Настройки владельца</h1>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Ценовая политика</h2>
          {policy && (
            <table>
              <tbody>
                <tr>
                  <td>Налог t</td>
                  <td>{(policy.taxFraction * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>Комиссия менеджера m</td>
                  <td>{(policy.commissionFraction * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>Резерв r</td>
                  <td>{(policy.reserveFraction * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td>Шаг округления итога</td>
                  <td>{policy.totalRoundingStepRub ?? "—"} ₽</td>
                </tr>
              </tbody>
            </table>
          )}
          <p className="muted" style={{ fontSize: 13 }}>
            Редактирование политики через интерфейс не реализовано в этой версии - значения меняются в справочнике
            src/lib/domain/referenceData.ts и записи PricingPolicy. См. README, раздел «Ограничения».
          </p>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Накладные (месяц)</h2>
          <table>
            <tbody>
              <tr>
                <td>Реклама (доля модульных домов {OVERHEAD_STARTING_POLICY.adsModularShare * 100}%)</td>
                <td>{OVERHEAD_STARTING_POLICY.adsMonthlyRub} ₽</td>
              </tr>
              <tr>
                <td>Офис</td>
                <td>{OVERHEAD_STARTING_POLICY.officeMonthlyRub} ₽</td>
              </tr>
              <tr>
                <td>Аренда цеха (условная)</td>
                <td>{OVERHEAD_STARTING_POLICY.workshopRentMonthlyRub} ₽</td>
              </tr>
              <tr>
                <td>Электричество цеха</td>
                <td>{OVERHEAD_STARTING_POLICY.electricityMonthlyRub} ₽</td>
              </tr>
              <tr>
                <td>Плановый сопоставимый выпуск/год</td>
                <td>{OVERHEAD_STARTING_POLICY.plannedComparableHousesPerYear} домов</td>
              </tr>
              <tr>
                <td>Амортизация инструмента/дом</td>
                <td>{OVERHEAD_STARTING_POLICY.toolAmortizationPerHouseRub} ₽</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Справочник материалов ({materials.length})</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Ед.</th>
                  <th>Цена</th>
                  <th>Статус</th>
                  <th>Источник</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td>{m.unit}</td>
                    <td>{m.priceRub ?? "не задана"}</td>
                    <td>
                      <span className="tag">{m.status}</span>
                    </td>
                    <td className="muted">{m.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Справочник работ ({workNorms.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Операция</th>
                <th>Ед. нормирования</th>
                <th>Часов/ед.</th>
                <th>Ставка</th>
                <th>Пакет</th>
              </tr>
            </thead>
            <tbody>
              {workNorms.map((w) => (
                <tr key={w.id}>
                  <td>{w.name}</td>
                  <td>{w.unitOfMeasure}</td>
                  <td>{w.hoursPerUnit ?? "трудоёмкость не задана"}</td>
                  <td>{w.ratePerHourRub ?? "—"}</td>
                  <td>{w.packagePriceRub ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="muted" style={{ fontSize: 12 }}>
          Базовый тариф труда: {REFERENCE_PRICES.laborRatePerHourRub} ₽/ч. Полное управление справочниками из
          интерфейса - следующий шаг развития (см. README).
        </p>
      </main>
    </div>
  );
}
