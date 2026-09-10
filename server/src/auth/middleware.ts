import type { Request, Response, NextFunction } from "express";
import { verifyToken, type AuthTokenPayload } from "./jwt.js";
import type { Role } from "../domain/roles.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

/**
 * Раздел 3: "Проверяй права для каждого API-запроса" — единая точка входа проверки токена.
 * Отсутствие/некорректность токена всегда 401, никогда не подставляется роль по умолчанию.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Требуется аутентификация" });
    return;
  }
  try {
    req.user = verifyToken(header.slice("Bearer ".length));
    next();
  } catch {
    res.status(401).json({ error: "Недействительный или истёкший токен" });
  }
}

export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Требуется аутентификация" });
      return;
    }
    if (!allowed.includes(req.user.role)) {
      res.status(403).json({ error: "Недостаточно прав для этого действия" });
      return;
    }
    next();
  };
}
