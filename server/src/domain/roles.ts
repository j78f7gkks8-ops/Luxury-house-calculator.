/**
 * Раздел 3: роли определяются учётной записью на сервере, не переключателем на клиенте.
 */
export type Role = "OWNER" | "MANAGER" | "WORKSHOP";

export const ROLES: Role[] = ["OWNER", "MANAGER", "WORKSHOP"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}
