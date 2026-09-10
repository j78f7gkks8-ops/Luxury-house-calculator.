import jwt from "jsonwebtoken";
import { env } from "../env.js";
import type { Role } from "../domain/roles.js";

export interface AuthTokenPayload {
  sub: string; // userId
  role: Role;
  name: string;
  email: string;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "12h" });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
}
