import { buildBarn96KyzylSnapshot, Barn96KyzylInput } from "./barn96Kyzyl";
import { buildNorma77Snapshot, Norma77Input } from "./norma77";
import { buildCatalogProjectSnapshot, CatalogProjectInput, GENERIC_CATALOG_OPTIONS } from "./catalogProject";
import { CatalogProject } from "../../catalog/schema";
import { EstimateSnapshot } from "../snapshot";

/** Owner-approved templates: confirmed geometry, norms and labor calibration. */
export const AVAILABLE_TEMPLATES = [
  { id: "barn-96-kyzyl", label: "Барн 96 / Кызыл", houseFamily: "BARN" as const },
  { id: "norma-77-v2", label: "Норма 77 V2", houseFamily: "NORMA_FLAT_ROOF" as const },
];

export type TemplateInput =
  | ({ templateId: "barn-96-kyzyl" } & Barn96KyzylInput)
  | ({ templateId: "norma-77-v2" } & Norma77Input)
  /**
   * Preliminary calculation from a catalog model. The parsed catalog record is
   * passed in by the caller, so the template layer never touches the database.
   */
  | ({ templateId: "catalog"; catalogProject: CatalogProject } & CatalogProjectInput);

export function buildSnapshot(input: TemplateInput): EstimateSnapshot {
  let snapshot: EstimateSnapshot;
  if (input.templateId === "barn-96-kyzyl") snapshot = buildBarn96KyzylSnapshot(input);
  else if (input.templateId === "norma-77-v2") snapshot = buildNorma77Snapshot(input);
  else if (input.templateId === "catalog") snapshot = buildCatalogProjectSnapshot(input.catalogProject, input);
  else throw new Error(`Unknown template ${(input as { templateId: string }).templateId}`);
  snapshot.templateInput = input;
  return snapshot;
}

export const BARN_96_OPTIONS = [
  { id: "warm-floor", label: "Водяной тёплый пол" },
  { id: "convectors", label: "Резервные конвекторы (6 шт)" },
  { id: "tile-bathroom", label: "Плитка в санузле (душевой угол)" },
  { id: "boiler-room", label: "Пристройка-кочегарка 3x3" },
];

export { GENERIC_CATALOG_OPTIONS };
