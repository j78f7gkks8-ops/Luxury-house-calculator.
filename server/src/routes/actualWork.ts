import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth/middleware.js";

export const actualWorkRouter = Router();

const entrySchema = z.object({
  projectId: z.string().min(1),
  operation: z.string().min(1),
  employeeOrCrew: z.string().min(1),
  entryMode: z.enum(["per_person", "crew_total"]),
  plannedHours: z.number().nullable().optional(),
  actualHours: z.number().positive(),
  date: z.string(), // ISO
  comment: z.string().optional(),
  isReworkOrDowntime: z.boolean().optional(),
  /**
   * Раздел 23 п.28: "повторный запрос выдачи материала или записи часов не создаёт второй
   * факт" — клиент присылает стабильный ключ (например, из UI-состояния кнопки "Сохранить"),
   * повторная отправка с тем же ключом возвращает уже созданную запись, а не дублирует её.
   */
  idempotencyKey: z.string().min(1),
});

actualWorkRouter.post("/", requireAuth, requireRole("WORKSHOP", "OWNER"), async (req, res) => {
  const parsed = entrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;

  const existing = await prisma.actualWorkEntry.findUnique({ where: { idempotencyKey: data.idempotencyKey } });
  if (existing) {
    res.status(200).json(existing);
    return;
  }

  const entry = await prisma.actualWorkEntry.create({
    data: {
      projectId: data.projectId,
      operation: data.operation,
      employeeOrCrew: data.employeeOrCrew,
      entryMode: data.entryMode,
      plannedHours: data.plannedHours ?? null,
      actualHours: data.actualHours,
      date: new Date(data.date),
      comment: data.comment,
      isReworkOrDowntime: data.isReworkOrDowntime ?? false,
      idempotencyKey: data.idempotencyKey,
      createdById: req.user!.sub,
    },
  });
  res.status(201).json(entry);
});

actualWorkRouter.get("/project/:projectId", requireAuth, async (req, res) => {
  const entries = await prisma.actualWorkEntry.findMany({ where: { projectId: req.params.projectId }, orderBy: { date: "desc" } });
  // Раздел 3: цех видит часы по разрешённым работам; менеджер по умолчанию видит только срок,
  // не почасовую детализацию. В этой версии ограничение применено на уровне ролей маршрута
  // (доступ сюда открыт цеху и владельцу; расширение для менеджера — по отдельному разрешению).
  if (req.user!.role === "MANAGER") {
    res.status(403).json({ error: "Почасовая детализация цеха доступна по отдельному разрешению" });
    return;
  }
  res.json(entries);
});
