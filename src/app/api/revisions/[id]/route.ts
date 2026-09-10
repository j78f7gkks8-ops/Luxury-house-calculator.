export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api/guard";
import { loadRevisionWithSnapshot } from "@/lib/domain/revisionAccess";
import { redactSnapshotForRole } from "@/lib/domain/rbac";

const SHOP_VISIBLE_STATUSES = ["PRODUCTION_TASK", "PRODUCTION", "INSTALLATION", "COMPLETED"];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireRole(["MANAGER", "OWNER", "SHOP"]);
  if (error) return error;

  const loaded = await loadRevisionWithSnapshot(params.id);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { revision, snapshot } = loaded;

  if (session.user.role === "SHOP" && !SHOP_VISIBLE_STATUSES.includes(revision.status)) {
    // Цех видит только актуальную выпущенную версию задания (§4).
    return NextResponse.json({ error: "Задание ещё не выпущено в производство" }, { status: 403 });
  }
  if (session.user.role === "MANAGER" && revision.createdByUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const redacted = redactSnapshotForRole(snapshot, session.user.role);
  return NextResponse.json({
    revision: {
      id: revision.id,
      version: revision.version,
      status: revision.status,
      createdAt: revision.createdAt,
      variantId: revision.variantId,
      projectId: revision.variant.projectId,
      projectTitle: revision.variant.project.title,
    },
    snapshot: redacted,
  });
}
