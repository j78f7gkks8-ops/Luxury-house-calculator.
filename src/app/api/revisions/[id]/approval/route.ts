import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";

/** Discount below the manager's allowed floor requires an explicit owner decision (§18). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole(["OWNER"]);
  if (error) return error;

  const body = (await req.json()) as { approvedPriceRub?: number; reason?: string };
  if (!body.approvedPriceRub || !body.reason?.trim()) {
    return NextResponse.json({ error: "Нужны цена и причина" }, { status: 400 });
  }

  const revision = await prisma.estimateRevision.findUnique({ where: { id: params.id } });
  if (!revision) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const approval = await prisma.approval.create({
    data: {
      revisionId: params.id,
      approvedPriceRub: body.approvedPriceRub,
      reason: body.reason.trim(),
      approvedByUserId: session.user.id,
    },
  });

  return NextResponse.json({ approval });
}
