import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { REFERENCE_PRICES, PRICING_STARTING_POLICY } from "../src/lib/domain/referenceData";

const prisma = new PrismaClient();

/**
 * Demo/test accounts are explicitly flagged (isDemo=true) and use throwaway
 * passwords printed below - §3: "тестовые аккаунты и демонстрационные
 * данные отдели от рабочих". Change/remove them before any real deployment.
 */
const DEMO_USERS = [
  { email: "owner@luxuryhouse.demo", name: "Владелец (демо)", role: "OWNER", password: "owner-demo-2026" },
  { email: "manager@luxuryhouse.demo", name: "Менеджер (демо)", role: "MANAGER", password: "manager-demo-2026" },
  { email: "shop@luxuryhouse.demo", name: "Цех (демо)", role: "SHOP", password: "shop-demo-2026" },
];

async function main() {
  for (const u of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, role: u.role, passwordHash, isDemo: true },
    });
  }

  await prisma.pricingPolicy.upsert({
    where: { id: "default-policy" },
    update: {},
    create: {
      id: "default-policy",
      name: "Стартовая политика владельца (§18)",
      taxFraction: PRICING_STARTING_POLICY.taxFraction,
      commissionFraction: PRICING_STARTING_POLICY.commissionFraction,
      reserveFraction: PRICING_STARTING_POLICY.reserveFraction,
      totalRoundingStepRub: 1000,
      isActive: true,
    },
  });

  const materials: Array<{
    sku?: string;
    name: string;
    unit: string;
    priceRub: number | null;
    status: string;
    source: string;
    comment?: string;
  }> = [
    { name: "Сухой каркасный пиломатериал", unit: "м3", priceRub: 35500, status: "CONFIRMED", source: "Приложение А" },
    { name: "Доска естественной влажности", unit: "м3", priceRub: 19500, status: "CONFIRMED", source: "Приложение А", comment: "Обрешётка; брус фундамента отдельный" },
    { name: "Брус обвязки фундамента", unit: "м3", priceRub: 20000, status: "CONFIRMED", source: "Приложение А" },
    { name: "OSB 9мм 1250x2500", unit: "лист", priceRub: 900, status: "CONFIRMED", source: "Приложение А" },
    { name: "OSB 12мм 1250x2500", unit: "лист", priceRub: 1120, status: "CONFIRMED", source: "Приложение А" },
    { name: "Фанера 12мм 1525x1525", unit: "лист", priceRub: 1200, status: "CONFIRMED", source: "Приложение А" },
    { name: "Утеплитель Knauf", unit: "м3", priceRub: 3800, status: "PRELIMINARY_BY_ANALOGY", source: "Приложение А" },
    { name: "Изоспан А", unit: "м2", priceRub: REFERENCE_PRICES.izospanARub, status: "CONFIRMED", source: "Приложение А" },
    { name: "Изоспан В", unit: "м2", priceRub: REFERENCE_PRICES.izospanBRub, status: "CONFIRMED", source: "Приложение А" },
    { name: "Изоспан АМ", unit: "м2", priceRub: REFERENCE_PRICES.izospanAmRub, status: "CONFIRMED", source: "Приложение А" },
    { name: "Планкен 20x120x3000", unit: "м2", priceRub: 1200, status: "CONFIRMED", source: "Приложение А" },
    { name: "Палубная доска террасы 27мм", unit: "м2", priceRub: 1750, status: "CONFIRMED", source: "Приложение А" },
    { name: "ЛДСП 16мм 2800x2070", unit: "лист", priceRub: 6500, status: "CONFIRMED", source: "Приложение А" },
    { name: "Замковый ПВХ-ламинат", unit: "м2", priceRub: 2000, status: "CONFIRMED", source: "Приложение А" },
    { name: "Плитка", unit: "м2", priceRub: REFERENCE_PRICES.tilePerM2Rub, status: "CONFIRMED", source: "Приложение А" },
    { name: "Основание и укладка плитки (пакет)", unit: "м2", priceRub: REFERENCE_PRICES.tileBasePackagePerM2Rub, status: "CONFIRMED", source: "Приложение А" },
    { name: "Профлист С21 кровли", unit: "м2", priceRub: 800, status: "PRELIMINARY_BY_ANALOGY", source: "Приложение А" },
    { name: "Чёрный конвектор", unit: "шт", priceRub: REFERENCE_PRICES.blackConvectorRub, status: "PRELIMINARY_BY_ANALOGY", source: "Приложение А", comment: "Бюджет старого набора; мощность подобрать" },
    { name: "Свая-шуруп 89x3000", unit: "шт", priceRub: null, status: "PRICE_NEEDED", source: "Импорт из счёта поставщика", comment: "Цена импортируется из соответствующего счёта, не является фиксированным прайсом" },
    { name: "ZOTA 4.5 Econom", sku: "119292", unit: "шт", priceRub: 16300, status: "PRELIMINARY_BY_ANALOGY", source: "Приложение А5 Водолей" },
    { name: "STOUT SMS 0917, 8 выходов", sku: "250267", unit: "шт", priceRub: 23098, status: "PRELIMINARY_BY_ANALOGY", source: "Приложение А5 Водолей", comment: "Под заказ" },
  ];
  for (const m of materials) {
    const existing = await prisma.material.findFirst({ where: { name: m.name } });
    if (!existing) {
      await prisma.material.create({
        data: { ...m, priceDate: m.priceRub !== null ? new Date("2026-09-09") : null },
      });
    }
  }

  const workNorms: Array<{ operationKey: string; name: string; unitOfMeasure: string; hoursPerUnit: number | null; ratePerHourRub: number | null; packagePriceRub?: number }> = [
    { operationKey: "production-installation", name: "Производство/монтаж", unitOfMeasure: "чел-час", hoursPerUnit: 1, ratePerHourRub: REFERENCE_PRICES.laborRatePerHourRub },
    { operationKey: "foundation-worker", name: "Работник фундамента", unitOfMeasure: "чел-час", hoursPerUnit: 1, ratePerHourRub: 750 },
    { operationKey: "porch-welder", name: "Сварщик крылец", unitOfMeasure: "чел-час", hoursPerUnit: 1, ratePerHourRub: 800 },
    { operationKey: "electrician-residential-module", name: "Электрик: жилой модуль", unitOfMeasure: "пакет", hoursPerUnit: null, ratePerHourRub: null, packagePriceRub: 25000 },
    { operationKey: "electrician-terrace-module", name: "Электрик: террасный модуль", unitOfMeasure: "пакет", hoursPerUnit: null, ratePerHourRub: null, packagePriceRub: 15000 },
    { operationKey: "internal-plumbing-install", name: "Монтаж внутренних труб воды/канализации", unitOfMeasure: "пакет", hoursPerUnit: null, ratePerHourRub: null, packagePriceRub: 20000 },
  ];
  for (const w of workNorms) {
    await prisma.workNorm.upsert({ where: { operationKey: w.operationKey }, update: {}, create: w });
  }

  console.log("Seed complete. Demo accounts:");
  for (const u of DEMO_USERS) console.log(`  ${u.role.padEnd(8)} ${u.email} / ${u.password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
