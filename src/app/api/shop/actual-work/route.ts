import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";

interface ActualWorkBody {
  revisionId: string;
  operationKey: string;
  employeeOrBrigade: string;
  hours: number;
  entryMode: "PER_PERSON" | "BRIGADE_TOTAL";
  reworkFlag?: boolean;
  idleFlag?: boolean;
  comment?: string;
  /** Client-generated, stable across retries of the same physical submission - §23 test #28. */
  idempotencyKey: string;
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(["SHOP", "OWNER"]);
  if (error) return error;

  const body = (await req.json()) as ActualWorkBody;
  if (!body.revisionId || !body.operationKey || !body.hours || !body.idempotencyKey) {
    return NextResponse.json({ error: "Не заполнены обязательные поля" }, { status: 400 });
  }
  if (body.hours <= 0) {
    return NextResponse.json({ error: "Часы должны быть положительными" }, { status: 400 });
  }

  try {
    const entry = await prisma.actualWorkEntry.create({
      data: {
        revisionId: body.revisionId,
        operationKey: body.operationKey,
        employeeOrBrigade: body.employeeOrBrigade,
        hours: body.hours,
        entryMode: body.entryMode,
        reworkFlag: body.reworkFlag ?? false,
        idleFlag: body.idleFlag ?? false,
        comment: body.comment ?? null,
        enteredByUserId: session.user.id,
        idempotencyKey: body.idempotencyKey,
      },
    });
    return NextResponse.json({ entry, deduplicated: false });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Same idempotency key already recorded - return the existing fact instead of creating a duplicate.
      const existing = await prisma.actualWorkEntry.findUnique({ where: { idempotencyKey: body.idempotencyKey } });
      return NextResponse.json({ entry: existing, deduplicated: true });
    }
    throw e;
  }
}
