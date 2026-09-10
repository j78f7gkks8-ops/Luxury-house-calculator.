export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api/guard";
import { buildSnapshot } from "@/lib/domain/templates";
import { redactSnapshotForRole } from "@/lib/domain/rbac";
import { CalcError } from "@/lib/calc/money";
import { resolveTemplateInput, templateRequestSchema } from "@/lib/domain/templateRequest";

/** Compute-only preview: never persisted, used by the manager wizard while choosing options. */
export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(["MANAGER", "OWNER"]);
  if (error) return error;

  const parsed = templateRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные параметры расчёта" }, { status: 400 });
  }

  try {
    const input = await resolveTemplateInput(parsed.data);
    const snapshot = buildSnapshot(input);
    const redacted = redactSnapshotForRole(snapshot, session.user.role);
    return NextResponse.json({ snapshot: redacted });
  } catch (e) {
    if (e instanceof CalcError) {
      return NextResponse.json({ error: e.message, code: e.code, details: e.details }, { status: 422 });
    }
    throw e;
  }
}
