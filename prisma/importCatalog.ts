import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { parseCatalog, toHouseProjectRow } from "../src/lib/catalog/parse";

const prisma = new PrismaClient();

const CATALOG_PATH = path.join(process.cwd(), "data/catalog/Luxury_House_Projects_Catalog.json");

/**
 * Import rule 2: upsert on the stable project_id. Re-running this script
 * updates the same 20 rows and never creates duplicates; order revisions of
 * actual jobs live in EstimateRevision and are untouched here.
 */
async function main() {
  const raw = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const catalog = parseCatalog(raw);

  let created = 0;
  let updated = 0;

  for (const project of catalog.projects) {
    const row = toHouseProjectRow(project);
    const existing = await prisma.houseProject.findUnique({ where: { projectId: row.projectId } });
    await prisma.houseProject.upsert({
      where: { projectId: row.projectId },
      create: row,
      update: row,
    });
    if (existing) updated++;
    else created++;
  }

  const total = await prisma.houseProject.count();
  console.log(
    `Каталог "${catalog.catalog_id}" (снимок ${catalog.snapshot_date}): создано ${created}, обновлено ${updated}, всего в базе ${total}.`,
  );

  const blocked = await prisma.houseProject.findMany({
    where: { floorPlanReviewStatus: "conflict_do_not_use" },
    select: { displayName: true },
  });
  if (blocked.length > 0) {
    console.log(
      `Заблокировано для расчёта до подтверждения: ${blocked.map((b) => b.displayName).join(", ")}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
