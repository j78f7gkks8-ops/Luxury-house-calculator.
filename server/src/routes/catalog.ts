import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { getProjectCatalog, getCalculationDefaults } from "../domain/estimate/catalogData.js";
import { STANDARD_WINDOW_CATALOG, BARN108_PANORAMIC_PRODUCTS } from "@lhc/calc-engine";

export const catalogRouter = Router();

/** Раздел 3: каталог планировок — доступен всем ролям, цен внутри каталога проектов нет. */
catalogRouter.get("/projects", requireAuth, (_req, res) => {
  res.json(getProjectCatalog());
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
