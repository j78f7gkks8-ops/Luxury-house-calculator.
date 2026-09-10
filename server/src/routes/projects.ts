import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { buildEstimate } from "../domain/estimate/buildEstimate.js";
import { projectEstimateForRole } from "../domain/estimate/roleViews.js";
import type { EstimateSelection } from "../domain/estimate/types.js";

export const projectsRouter = Router();

const createProjectSchema = z.object({
  name: z.string().min(1),
  customerName: z.string().optional(),
  catalogTemplateId: z.string().min(1),
  familyType: z.enum(["BARN", "NORMA"]),
});

projectsRouter.post("/", requireAuth, requireRole("MANAGER", "OWNER"), async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { name, customerName, catalogTemplateId, familyType } = parsed.data;

  let customerId: string | undefined;
  if (customerName) {
    const customer = await prisma.customer.create({ data: { name: customerName } });
    customerId = customer.id;
  }

  const project = await prisma.project.create({
    data: { name, customerId, catalogTemplateId, familyType, createdById: req.user!.sub },
  });
  res.status(201).json(project);
});

/**
 * Раздел 3: цех должен видеть только назначенные проекты. В этой версии нет отдельной
 * таблицы назначений бригад — ограничение честно задокументировано в README как известный
 * пробел; здесь цех получает список без коммерческих полей (сами поля списка их не содержат).
 */
projectsRouter.get("/", requireAuth, async (_req, res) => {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: true },
  });
  res.json(projects);
});

projectsRouter.get("/:id", requireAuth, async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.id }, include: { customer: true, variants: true } });
  if (!project) {
    res.status(404).json({ error: "Проект не найден" });
    return;
  }
  // Раздел 3: selectionJson может содержать выбранные менеджером цены опций/режим
  // ценообразования — цех эти коммерческие поля видеть не должен даже как "сырые" данные.
  if (req.user!.role === "WORKSHOP") {
    res.json({ ...project, variants: project.variants.map(({ selectionJson, ...rest }) => rest) });
    return;
  }
  res.json(project);
});

const selectionSchema: z.ZodType<EstimateSelection> = z.any();

const createVariantSchema = z.object({
  label: z.string().min(1),
  selection: selectionSchema,
});

/**
 * ВАЖНО: resultJson хранит ПОЛНУЮ, ничем не отфильтрованную себестоимость и цены закупки.
 * Наружу из этого модуля отдаётся только safeSnapshot (id/version/createdAt) — самому
 * resultJson нельзя попадать в HTTP-ответ ни при каких условиях, кроме маршрутов,
 * прошедших requireRole("OWNER") (см. exports.ts). Раздел 3: "Не отдавай запрещённые данные
 * в JSON... даже если основной ответ отфильтрован" — нельзя полагаться на то, что клиент
 * прочитает только поле estimate и проигнорирует остальное.
 */
async function computeAndStoreSnapshot(projectVariantId: string, selection: EstimateSelection) {
  const result = buildEstimate(selection);
  const previousCount = await prisma.estimateSnapshot.count({ where: { projectVariantId } });
  const snapshot = await prisma.estimateSnapshot.create({
    data: {
      projectVariantId,
      version: previousCount + 1,
      resultJson: JSON.stringify(result),
      referenceCatalogVersion: result.engineVersion,
    },
  });
  const safeSnapshot = { id: snapshot.id, projectVariantId: snapshot.projectVariantId, version: snapshot.version, createdAt: snapshot.createdAt };
  return { safeSnapshot, result };
}

projectsRouter.post("/:id/variants", requireAuth, requireRole("MANAGER", "OWNER"), async (req, res) => {
  const parsed = createVariantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const project = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!project) {
    res.status(404).json({ error: "Проект не найден" });
    return;
  }

  let result;
  try {
    const variant = await prisma.projectVariant.create({
      data: {
        projectId: project.id,
        label: parsed.data.label,
        status: "draft",
        selectionJson: JSON.stringify(parsed.data.selection),
        createdById: req.user!.sub,
      },
    });
    const computed = await computeAndStoreSnapshot(variant.id, parsed.data.selection as EstimateSelection);
    result = { variant, snapshot: computed.safeSnapshot, estimate: projectEstimateForRole(computed.result, req.user!.role) };
  } catch (e: any) {
    res.status(422).json({ error: `Не удалось рассчитать смету: ${e.message}` });
    return;
  }
  res.status(201).json(result);
});

/**
 * Раздел 20: "кнопка «Пересчитать» создаёт новый вариант и показывает разницу" — сюда же
 * можно передать обновлённый selection; предыдущие снимки не изменяются.
 */
projectsRouter.post("/:id/variants/:variantId/recalculate", requireAuth, requireRole("MANAGER", "OWNER"), async (req, res) => {
  const variant = await prisma.projectVariant.findUnique({ where: { id: req.params.variantId } });
  if (!variant || variant.projectId !== req.params.id) {
    res.status(404).json({ error: "Вариант не найден" });
    return;
  }
  const selection: EstimateSelection = req.body?.selection ?? JSON.parse(variant.selectionJson);
  try {
    const computed = await computeAndStoreSnapshot(variant.id, selection);
    if (req.body?.selection) {
      await prisma.projectVariant.update({ where: { id: variant.id }, data: { selectionJson: JSON.stringify(selection) } });
    }
    res.json({ snapshot: computed.safeSnapshot, estimate: projectEstimateForRole(computed.result, req.user!.role) });
  } catch (e: any) {
    res.status(422).json({ error: `Не удалось пересчитать смету: ${e.message}` });
  }
});

projectsRouter.get("/:id/variants/:variantId", requireAuth, async (req, res) => {
  const variant = await prisma.projectVariant.findUnique({
    where: { id: req.params.variantId },
    include: { snapshots: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!variant || variant.projectId !== req.params.id) {
    res.status(404).json({ error: "Вариант не найден" });
    return;
  }
  const latest = variant.snapshots[0];
  if (!latest) {
    res.status(404).json({ error: "У варианта ещё нет расчёта" });
    return;
  }
  const result = JSON.parse(latest.resultJson);
  res.json({ variant: { id: variant.id, label: variant.label, status: variant.status }, version: latest.version, estimate: projectEstimateForRole(result, req.user!.role) });
});

projectsRouter.get("/:id/variants/:variantId/snapshots", requireAuth, requireRole("OWNER"), async (req, res) => {
  const snapshots = await prisma.estimateSnapshot.findMany({
    where: { projectVariantId: req.params.variantId },
    orderBy: { version: "desc" },
  });
  res.json(snapshots.map((s) => ({ id: s.id, version: s.version, createdAt: s.createdAt, engineVersion: s.referenceCatalogVersion })));
});
