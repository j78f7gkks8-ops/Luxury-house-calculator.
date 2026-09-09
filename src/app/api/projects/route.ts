export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";
import { buildSnapshot } from "@/lib/domain/templates";
import { CALC_ENGINE_VERSION } from "@/lib/domain/snapshot";
import { CalcError } from "@/lib/calc/money";
import { resolveTemplateInput, templateRequestSchema } from "@/lib/domain/templateRequest";

interface CreateProjectBody {
  customerName: string;
  phone?: string;
  title: string;
  templateInput: unknown;
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(["MANAGER", "OWNER"]);
  if (error) return error;

  const body = (await req.json()) as CreateProjectBody;
  if (!body.customerName?.trim() || !body.title?.trim()) {
    return NextResponse.json({ error: "customerName и title обязательны" }, { status: 400 });
  }

  const parsedTemplate = templateRequestSchema.safeParse(body.templateInput);
  if (!parsedTemplate.success) {
    return NextResponse.json({ error: "Некорректные параметры расчёта" }, { status: 400 });
  }

  let snapshot;
  try {
    snapshot = buildSnapshot(await resolveTemplateInput(parsedTemplate.data));
  } catch (e) {
    if (e instanceof CalcError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 422 });
    }
    throw e;
  }

  const houseFamily = snapshot.houseFamily;

  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: { name: body.customerName.trim(), phone: body.phone ?? null },
    });
    const project = await tx.project.create({
      data: {
        customerId: customer.id,
        title: body.title.trim(),
        houseFamily,
        createdByUserId: session.user.id,
      },
    });
    const variant = await tx.projectVariant.create({
      data: { projectId: project.id, name: "Вариант 1" },
    });
    const revision = await tx.estimateRevision.create({
      data: {
        variantId: variant.id,
        version: 1,
        status: "DRAFT",
        calcEngineVersion: CALC_ENGINE_VERSION,
        snapshotJson: JSON.stringify(snapshot),
        createdByUserId: session.user.id,
      },
    });
    return { project, variant, revision };
  });

  return NextResponse.json({
    projectId: result.project.id,
    variantId: result.variant.id,
    revisionId: result.revision.id,
  });
}

export async function GET() {
  const { session, error } = await requireRole(["MANAGER", "OWNER", "SHOP"]);
  if (error) return error;

  const where =
    session.user.role === "OWNER"
      ? {}
      : session.user.role === "MANAGER"
        ? { createdByUserId: session.user.id }
        : // SHOP: only projects that have at least one released production task
          { variants: { some: { revisions: { some: { status: { in: ["PRODUCTION_TASK", "PRODUCTION", "INSTALLATION", "COMPLETED"] } } } } } };

  const projects = await prisma.project.findMany({
    where,
    include: {
      customer: true,
      variants: {
        include: {
          revisions: {
            orderBy: { version: "desc" },
            take: 1,
            select: { id: true, version: true, status: true, createdAt: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ projects });
}
