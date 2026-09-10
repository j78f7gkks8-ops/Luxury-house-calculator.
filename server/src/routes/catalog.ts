import { Router } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth } from "../auth/middleware.js";
import { getProjectCatalog, getCalculationDefaults, findProjectById } from "../domain/estimate/catalogData.js";
import { STANDARD_WINDOW_CATALOG, BARN108_PANORAMIC_PRODUCTS } from "@lhc/calc-engine";

export const catalogRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src/routes -> repo root /data/catalog-sources
const CATALOG_SOURCES_DIR = path.resolve(__dirname, "../../../data/catalog-sources");

/** Раздел 3: каталог планировок — доступен всем ролям, цен внутри каталога проектов нет. */
catalogRouter.get("/projects", requireAuth, (_req, res) => {
  res.json(getProjectCatalog());
});

/**
 * Раздел 7.4/20.1: реальный исходный PDF планировки (когда он действительно загружен и его
 * sha256 подтверждён — см. sourceFileAvailable/documentedSha256), а не подстановка по имени.
 * Пока таким файлом располагает только одна планировка каталога (Барн 93 V2) — для остальных
 * 404, и клиент обязан падать обратно на схематичную картинку, а не на пустой экран.
 */
catalogRouter.get("/projects/:id/source-pdf", requireAuth, (req, res) => {
  const entry = findProjectById(req.params.id);
  if (!entry || !entry.sourceFileAvailable) {
    res.status(404).json({ error: "Исходный PDF для этой планировки не загружен" });
    return;
  }
  const filePath = path.join(CATALOG_SOURCES_DIR, `${entry.id}.pdf`);
  if (!existsSync(filePath)) {
    res.status(404).json({ error: "Исходный PDF для этой планировки не загружен" });
    return;
  }
  res.type("application/pdf").sendFile(filePath);
});

catalogRouter.get("/windows", requireAuth, (_req, res) => {
  res.json({ standard: STANDARD_WINDOW_CATALOG, barn108Panoramic: BARN108_PANORAMIC_PRODUCTS });
});

/** Дефолты расчёта доступны только владельцу — это тарифы/нормы, а не публичный каталог. */
catalogRouter.get("/calculation-defaults", requireAuth, (req, res) => {
  if (req.user!.role !== "OWNER") {
    res.status(403).json({ error: "Тарифы и нормы доступны только владельцу" });
    return;
  }
  res.json(getCalculationDefaults());
});
