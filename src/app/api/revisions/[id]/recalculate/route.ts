import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";
import { loadRevisionWithSnapshot } from "@/lib/domain/revisionAccess";
import { buildSnapshot, TemplateInput } from "@/lib/domain/templates";
import { CALC_ENGINE_VERSION } from "@/lib/domain/snapshot";

/**
 * §20: "кнопка «Пересчитать по новым ценам» создаёт новый вариант и
 * показывает разницу" - the prior revision row is never mutated. This
 * route always inserts a new row (version+1, parentRevisionId set).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole(["MANAGER", "OWNER"]);
  if (error) return error;

  const loaded = await loadRevisionWithSnapshot(params.id);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { revision: parent, snapshot: parentSnapshot } = loaded;

  if (session.user.role === "MANAGER" && parent.createdByUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { templateInput?: TemplateInput };
  const templateInput = body.templateInput ?? (parentSnapshot.templateInput as TemplateInput);
  const newSnapshot = buildSnapshot(templateInput);

  const latest = await prisma.estimateRevision.findFirst({
    where: { variantId: parent.variantId },
    orderBy: { version: "desc" },
  });
  const nextVersion = (latest?.version ?? parent.version) + 1;

  const created = await prisma.estimateRevision.create({
    data: {
      variantId: parent.variantId,
      version: nextVersion,
      status: "DRAFT",
      calcEngineVersion: CALC_ENGINE_VERSION,
      snapshotJson: JSON.stringify(newSnapshot),
      parentRevisionId: parent.id,
      createdByUserId: session.user.id,
    },
  });

  const priceDeltaRub = newSnapshot.priceSummary.roundedPriceRub - parentSnapshot.priceSummary.roundedPriceRub;
  // Cost is owner-only (§3) - never leak it into a manager-visible diff.
  const costDeltaRub =
    session.user.role === "OWNER"
      ? newSnapshot.costSummary.fullCostRub - parentSnapshot.costSummary.fullCostRub
      : undefined;

  return NextResponse.json({
    revisionId: created.id,
    version: created.version,
    parentRevisionId: parent.id,
    diff: { priceDeltaRub, costDeltaRub },
  });
}
