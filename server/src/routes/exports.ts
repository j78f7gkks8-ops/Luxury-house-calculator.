import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { buildOwnerXlsx } from "../exports/xlsx.js";
import { buildProductionXlsx } from "../exports/productionSheet.js";
import { buildClientPdf } from "../exports/pdf.js";
import { buildClientDocx } from "../exports/docx.js";
import { toWorkshopView } from "../domain/estimate/roleViews.js";
import type { EstimateResult } from "../domain/estimate/types.js";

export const exportsRouter = Router();

async function loadLatestSnapshot(projectId: string, variantId: string) {
  const variant = await prisma.projectVariant.findUnique({
    where: { id: variantId },
    include: { snapshots: { orderBy: { version: "desc" }, take: 1 }, project: { include: { customer: true } } },
  });
  if (!variant || variant.projectId !== projectId) return null;
  const snap = variant.snapshots[0];
  if (!snap) return null;
  return { variant, snapshot: snap, estimate: JSON.parse(snap.resultJson) as EstimateResult };
}

/** Раздел 3/21: полная внутренняя смета XLSX — только владелец. */
exportsRouter.get("/projects/:id/variants/:variantId/owner-xlsx", requireAuth, requireRole("OWNER"), async (req, res) => {
  const data = await loadLatestSnapshot(req.params.id, req.params.variantId);
  if (!data) {
    res.status(404).json({ error: "Расчёт не найден" });
    return;
  }
  const buffer = await buildOwnerXlsx(data.variant.project.name, data.variant.label, data.estimate);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="internal-estimate-${data.snapshot.version}.xlsx"`);
  res.send(buffer);
});

/** Раздел 3/21: производственная ведомость без цен — цех и владелец. */
exportsRouter.get("/projects/:id/variants/:variantId/production-xlsx", requireAuth, requireRole("WORKSHOP", "OWNER"), async (req, res) => {
  const data = await loadLatestSnapshot(req.params.id, req.params.variantId);
  if (!data) {
    res.status(404).json({ error: "Расчёт не найден" });
    return;
  }
  const view = toWorkshopView(data.estimate);
  const buffer = await buildProductionXlsx(data.variant.project.name, view);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="production-sheet-${data.snapshot.version}.xlsx"`);
  res.send(buffer);
});

/** Раздел 3/21: клиентская смета — менеджер и владелец, без закупочных цен/себестоимости. */
exportsRouter.get("/projects/:id/variants/:variantId/client-pdf", requireAuth, requireRole("MANAGER", "OWNER"), async (req, res) => {
  const data = await loadLatestSnapshot(req.params.id, req.params.variantId);
  if (!data) {
    res.status(404).json({ error: "Расчёт не найден" });
    return;
  }
  const buffer = await buildClientPdf(
    {
      quoteNumber: data.snapshot.id.slice(0, 8),
      date: new Date(data.snapshot.createdAt).toLocaleDateString("ru-RU"),
      version: data.snapshot.version,
      customerName: data.variant.project.customer?.name ?? "не указан",
      projectName: data.variant.project.name,
    },
    data.estimate
  );
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="quote-${data.snapshot.version}.pdf"`);
  res.send(buffer);
});

exportsRouter.get("/projects/:id/variants/:variantId/client-docx", requireAuth, requireRole("MANAGER", "OWNER"), async (req, res) => {
  const data = await loadLatestSnapshot(req.params.id, req.params.variantId);
  if (!data) {
    res.status(404).json({ error: "Расчёт не найден" });
    return;
  }
  const buffer = await buildClientDocx(
    {
      quoteNumber: data.snapshot.id.slice(0, 8),
      date: new Date(data.snapshot.createdAt).toLocaleDateString("ru-RU"),
      version: data.snapshot.version,
      customerName: data.variant.project.customer?.name ?? "не указан",
      projectName: data.variant.project.name,
    },
    data.estimate
  );
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="quote-${data.snapshot.version}.docx"`);
  res.send(buffer);
});
