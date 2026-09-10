import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/src/domain/estimate -> repo root /data
const DATA_ROOT = path.resolve(__dirname, "../../../../data");

function loadJson<T>(filename: string): T {
  const p = path.join(DATA_ROOT, filename);
  return JSON.parse(readFileSync(p, "utf-8")) as T;
}

export interface ProjectCatalogEntry {
  id: string;
  name: string;
  family: "BARN" | "NORMA";
  insideByExplicationM2: number;
  openZonesM2: Record<string, number>;
  closedFootprintM2: number;
  pages: number;
  rooms: { name: string; areaM2: number }[];
  footprintNote: string;
  sourceFile: string;
  documentedSha256: string;
  sourceFileAvailable: boolean;
  pileFieldTemplate?: string;
  versionConflicts?: string[];
}

export interface ProjectCatalog {
  schema_version: string;
  projects: ProjectCatalogEntry[];
}

export interface CalculationDefaults {
  [key: string]: any;
}

let _projectCatalog: ProjectCatalog | null = null;
let _calculationDefaults: CalculationDefaults | null = null;
let _referenceTables: any = null;
let _windowCatalog: any = null;

export function getProjectCatalog(): ProjectCatalog {
  if (!_projectCatalog) _projectCatalog = loadJson<ProjectCatalog>("project_catalog.json");
  return _projectCatalog;
}

export function getCalculationDefaults(): CalculationDefaults {
  if (!_calculationDefaults) _calculationDefaults = loadJson<CalculationDefaults>("calculation_defaults.json");
  return _calculationDefaults;
}

export function getReferenceTables(): any {
  if (!_referenceTables) _referenceTables = loadJson("reference_tables.json");
  return _referenceTables;
}

export function getWindowCatalogData(): any {
  if (!_windowCatalog) _windowCatalog = loadJson("window_catalog.json");
  return _windowCatalog;
}

export function findProjectById(id: string): ProjectCatalogEntry | undefined {
  return getProjectCatalog().projects.find((p) => p.id === id);
}
