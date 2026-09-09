import { prisma } from "@/lib/prisma";
import { EstimateSnapshot } from "./snapshot";

export async function loadRevisionWithSnapshot(revisionId: string) {
  const revision = await prisma.estimateRevision.findUnique({
    where: { id: revisionId },
    include: { variant: { include: { project: true } } },
  });
  if (!revision) return null;
  const snapshot = JSON.parse(revision.snapshotJson) as EstimateSnapshot;
  return { revision, snapshot };
}
