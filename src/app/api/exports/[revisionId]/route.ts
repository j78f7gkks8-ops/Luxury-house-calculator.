export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { permissions } from "@/lib/domain/rbac";
import { loadRevisionWithSnapshot } from "@/lib/domain/revisionAccess";
import { prisma } from "@/lib/prisma";
import { renderHtmlToPdf } from "@/lib/export/pdf";
import { clientEstimateHtml } from "@/lib/export/clientEstimate";
import { productionTaskHtml } from "@/lib/export/productionTask";
import { buildClientDocx } from "@/lib/export/clientDocx";
import { buildOwnerXlsx } from "@/lib/export/ownerXlsx";
import { buildProductionXlsx } from "@/lib/export/productionXlsx";
import { redactSnapshotForRole } from "@/lib/domain/rbac";
import { ExportKind } from "@/lib/domain/enums";

const SHOP_VISIBLE_STATUSES = ["PRODUCTION_TASK", "PRODUCTION", "INSTALLATION", "COMPLETED"];

const KIND_CONTENT_TYPE: Record<ExportKind, string> = {
  CLIENT_PDF: "application/pdf",
  CLIENT_DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  OWNER_XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  PRODUCTION_PDF: "application/pdf",
  PRODUCTION_XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  JSON: "application/json",
};

export async function GET(req: NextRequest, { params }: { params: { revisionId: string } }) {
  const session = await requireSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const kind = (req.nextUrl.searchParams.get("kind") ?? "") as ExportKind;
  if (!(kind in KIND_CONTENT_TYPE)) {
    return NextResponse.json({ error: "Некорректный тип экспорта" }, { status: 400 });
  }

  const role = session.user.role;
  const allowed =
    kind === "CLIENT_PDF" || kind === "CLIENT_DOCX"
      ? permissions.canExportClientEstimate(role)
      : kind === "OWNER_XLSX"
        ? permissions.canExportFullInternalEstimate(role)
        : kind === "PRODUCTION_PDF" || kind === "PRODUCTION_XLSX"
          ? permissions.canExportProductionTask(role)
          : true; // JSON: any authenticated role, but always redacted below

  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const loaded = await loadRevisionWithSnapshot(params.revisionId);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { revision, snapshot } = loaded;

  if (role === "SHOP" && !SHOP_VISIBLE_STATUSES.includes(revision.status)) {
    return NextResponse.json({ error: "Задание ещё не выпущено в производство" }, { status: 403 });
  }
  if (role === "MANAGER" && revision.createdByUserId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const meta = {
    projectTitle: revision.variant.project.title,
    customerName: (await prisma.customer.findUnique({ where: { id: revision.variant.project.customerId } }))?.name ?? "",
    revisionVersion: revision.version,
    objectLabel: `${revision.variant.project.title} (${revision.variant.name})`,
  };

  let bytes: Buffer;
  let filename: string;

  switch (kind) {
    case "CLIENT_PDF": {
      const html = clientEstimateHtml(snapshot, meta);
      bytes = await renderHtmlToPdf(html);
      filename = `predlozhenie-${revision.id}-v${revision.version}.pdf`;
      break;
    }
    case "CLIENT_DOCX": {
      bytes = await buildClientDocx(snapshot, meta);
      filename = `predlozhenie-${revision.id}-v${revision.version}.docx`;
      break;
    }
    case "OWNER_XLSX": {
      bytes = await buildOwnerXlsx(snapshot, meta);
      filename = `smeta-vnutrennyaya-${revision.id}-v${revision.version}.xlsx`;
      break;
    }
    case "PRODUCTION_PDF": {
      const html = productionTaskHtml(snapshot, meta);
      bytes = await renderHtmlToPdf(html);
      filename = `zadanie-${revision.id}-v${revision.version}.pdf`;
      break;
    }
    case "PRODUCTION_XLSX": {
      bytes = await buildProductionXlsx(snapshot, meta);
      filename = `vedomost-${revision.id}-v${revision.version}.xlsx`;
      break;
    }
    case "JSON": {
      const redacted = redactSnapshotForRole(snapshot, role);
      bytes = Buffer.from(JSON.stringify(redacted, null, 2));
      filename = `smeta-${revision.id}-v${revision.version}.json`;
      break;
    }
  }

  await prisma.exportSnapshot.create({
    data: {
      revisionId: revision.id,
      kind,
      filePath: `generated-on-demand:${filename}`,
      createdByUserId: session.user.id,
    },
  });

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": KIND_CONTENT_TYPE[kind],
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
