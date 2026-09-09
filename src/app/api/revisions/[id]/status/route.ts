import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";
import { REVISION_STATUSES } from "@/lib/domain/enums";

/**
 * Advancing status (e.g. releasing a revision to PRODUCTION_TASK) does not
 * rewrite the revision's snapshot - only its lifecycle stage. The snapshot
 * itself stays immutable (§20).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole(["MANAGER", "OWNER"]);
  if (error) return error;

  const body = (await req.json()) as { status?: string };
  if (!body.status || !REVISION_STATUSES.includes(body.status as (typeof REVISION_STATUSES)[number])) {
    return NextResponse.json({ error: "Некорректный статус" }, { status: 400 });
  }

  const revision = await prisma.estimateRevision.findUnique({ where: { id: params.id } });
  if (!revision) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.user.role === "MANAGER" && revision.createdByUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.estimateRevision.update({
    where: { id: params.id },
    data: { status: body.status },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
