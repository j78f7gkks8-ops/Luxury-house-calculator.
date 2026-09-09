import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { AppRole } from "@/lib/domain/enums";

/**
 * Every mutating/reading API route must call this before touching data -
 * §3: "Проверяй права для каждого API-запроса". Never trust a role sent by
 * the client; it always comes from the server session.
 */
export async function requireRole(allowed: AppRole[]) {
  const session = await requireSession();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!allowed.includes(session.user.role)) {
    return { session: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session, error: null as null };
}
