import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { verifyPassword } from "../auth/hash.js";
import { signToken } from "../auth/jwt.js";
import { isRole } from "../domain/roles.js";
import { requireAuth } from "../auth/middleware.js";

export const authRouter = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Некорректные данные входа" });
    return;
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Неверный email или пароль" });
    return;
  }
  if (!isRole(user.role)) {
    res.status(500).json({ error: "Некорректная роль пользователя в базе" });
    return;
  }
  const token = signToken({ sub: user.id, role: user.role, name: user.name, email: user.email });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
