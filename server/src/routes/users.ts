import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { hashPassword } from "../auth/hash.js";

export const usersRouter = Router();

/**
 * Раздел 3: "Владелец управляет... правами". Все маршруты этого файла — только владелец.
 * Пользователей не удаляем физически (DELETE): у них могут быть созданные проекты, версии
 * смет, загруженные файлы, факты цеха — эти записи ссылаются на автора и не должны
 * "осиротеть". Вместо этого — деактивация (isActive=false): вход блокируется, история
 * остаётся читаемой (кто на самом деле создал/утвердил что-либо).
 */
usersRouter.use(requireAuth, requireRole("OWNER"));

function toSafeUser(u: { passwordHash: string; [k: string]: unknown }) {
  const { passwordHash, ...rest } = u;
  return rest;
}

usersRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  res.json(users.map(toSafeUser));
});

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["OWNER", "MANAGER", "WORKSHOP"]),
  password: z.string().min(8, "Пароль должен быть не короче 8 символов"),
});

usersRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    res.status(409).json({ error: "Пользователь с таким email уже существует" });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: { email: parsed.data.email, name: parsed.data.name, role: parsed.data.role, passwordHash, isDemo: false },
  });
  res.status(201).json(toSafeUser(user));
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["OWNER", "MANAGER", "WORKSHOP"]).optional(),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional(),
});

async function activeOwnersExcluding(userId: string): Promise<number> {
  return prisma.user.count({ where: { role: "OWNER", isActive: true, id: { not: userId } } });
}

/** Раздел 3: нельзя оставить систему без единого активного владельца — это самоблокировка. */
async function wouldRemoveLastOwner(targetId: string, targetRole: string): Promise<boolean> {
  if (targetRole !== "OWNER") return false;
  const remaining = await activeOwnersExcluding(targetId);
  return remaining < 1;
}

usersRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ error: "Пользователь не найден" });
    return;
  }
  const data = parsed.data;
  const isSelf = req.user!.sub === target.id;

  if (isSelf && data.isActive === false) {
    res.status(400).json({ error: "Нельзя деактивировать собственную учётную запись" });
    return;
  }
  const losingOwnerRole = data.role !== undefined && data.role !== "OWNER";
  const losingActive = data.isActive === false;
  if ((losingOwnerRole || losingActive) && (await wouldRemoveLastOwner(target.id, target.role))) {
    res.status(400).json({ error: "Нельзя оставить систему без единого активного владельца" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.password !== undefined) updateData.passwordHash = await hashPassword(data.password);

  const updated = await prisma.user.update({ where: { id: target.id }, data: updateData });
  res.json(toSafeUser(updated));
});

usersRouter.delete("/:id", async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) {
    res.status(404).json({ error: "Пользователь не найден" });
    return;
  }
  if (req.user!.sub === target.id) {
    res.status(400).json({ error: "Нельзя удалить собственную учётную запись" });
    return;
  }
  if (await wouldRemoveLastOwner(target.id, target.role)) {
    res.status(400).json({ error: "Нельзя оставить систему без единого активного владельца" });
    return;
  }
  const updated = await prisma.user.update({ where: { id: target.id }, data: { isActive: false } });
  res.json(toSafeUser(updated));
});
