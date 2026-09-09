export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";

/**
 * Catalog models available for selection. Areas are returned as the separate,
 * individually-defined figures they are (rules 4, 5) - the client is never
 * handed a single "area" to display as the truth.
 */
export async function GET() {
  const { error } = await requireRole(["MANAGER", "OWNER"]);
  if (error) return error;

  const rows = await prisma.houseProject.findMany({ orderBy: [{ category: "asc" }, { advertisedAreaM2: "asc" }] });

  const projects = rows.map((r) => ({
    projectId: r.projectId,
    displayName: r.displayName,
    nameAliases: JSON.parse(r.nameAliasesJson) as string[],
    category: r.category,
    series: r.series,
    sourceUrl: r.sourceUrl,
    planImagePath: r.floorPlanFile ? `/${r.floorPlanFile}` : null,
    planReviewStatus: r.floorPlanReviewStatus,
    blockedForCalculation: r.floorPlanReviewStatus === "conflict_do_not_use",
    advertisedAreaM2: r.advertisedAreaM2,
    areaDefinition: r.areaDefinition,
    labeledIndoorAreaSumM2: r.labeledIndoorAreaSumM2,
    terraceLabeledAreaM2: r.terraceLabeledAreaM2,
    enclosedBodyGrossAreaM2: r.enclosedBodyGrossAreaM2,
    ceilingHeightM: r.ceilingHeightM,
    roofText: r.roofText,
    bedroomsCount: r.bedroomsCount,
    bathroomsCount: r.bathroomsCount,
    issues: JSON.parse(r.issuesJson) as { code: string; message: string }[],
    approvedTemplateId: r.approvedTemplateId,
  }));

  return NextResponse.json({ projects });
}
