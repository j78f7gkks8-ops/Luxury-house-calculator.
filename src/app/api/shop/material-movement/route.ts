import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";

interface MaterialMovementBody {
  revisionId: string;
  materialName: string;
  direction: "ISSUED" | "RETURNED" | "CONSUMED" | "SHORTAGE";
  qty: number;
  unit: string;
  photoRef?: string;
  comment?: string;
  idempotencyKey: string;
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireRole(["SHOP", "OWNER"]);
  if (error) return error;

  const body = (await req.json()) as MaterialMovementBody;
  if (!body.revisionId || !body.materialName || !body.unit || !body.idempotencyKey) {
    return NextResponse.json({ error: "Не заполнены обязательные поля" }, { status: 400 });
  }
  if (body.qty <= 0) {
    return NextResponse.json({ error: "Количество должно быть положительным" }, { status: 400 });
  }

  try {
    const movement = await prisma.materialMovement.create({
      data: {
        revisionId: body.revisionId,
        materialName: body.materialName,
        direction: body.direction,
        qty: body.qty,
        unit: body.unit,
        photoRef: body.photoRef ?? null,
        comment: body.comment ?? null,
        enteredByUserId: session.user.id,
        idempotencyKey: body.idempotencyKey,
      },
    });
    return NextResponse.json({ movement, deduplicated: false });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.materialMovement.findUnique({ where: { idempotencyKey: body.idempotencyKey } });
      return NextResponse.json({ movement: existing, deduplicated: true });
    }
    throw e;
  }
}
