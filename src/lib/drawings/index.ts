import fs from "node:fs";
import path from "node:path";
import { drawingRevisionSchema, DrawingRevision } from "./schema";

const DRAWING_FILES: Record<string, string> = {
  lh_house_barn96: "data/drawings/barn96/revision.json",
};

let cache: Record<string, DrawingRevision> = {};

/** Loads and validates the drawing revision for a catalog project, if one exists. */
export function loadDrawingRevision(projectId: string): DrawingRevision | null {
  const file = DRAWING_FILES[projectId];
  if (!file) return null;
  if (cache[projectId]) return cache[projectId]!;

  const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), file), "utf8"));
  const revision = drawingRevisionSchema.parse(raw);
  if (revision.project_id !== projectId) {
    throw new Error(
      `Чертёжная редакция ${revision.drawing_revision_id} относится к ${revision.project_id}, а запрошена для ${projectId}`,
    );
  }
  cache[projectId] = revision;
  return revision;
}

export function hasDrawingRevision(projectId: string): boolean {
  return projectId in DRAWING_FILES;
}

export function projectIdsWithDrawings(): string[] {
  return Object.keys(DRAWING_FILES);
}

/** Test seam: drops the memoised revisions. */
export function clearDrawingCache(): void {
  cache = {};
}

export * from "./schema";
export * from "./derive";
