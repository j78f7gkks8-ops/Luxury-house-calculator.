export const ROLES = ["SHOP", "MANAGER", "OWNER"] as const;
export type AppRole = (typeof ROLES)[number];

export const HOUSE_FAMILIES = ["BARN", "NORMA_FLAT_ROOF"] as const;
export type HouseFamily = (typeof HOUSE_FAMILIES)[number];

export const REVISION_STATUSES = [
  "DRAFT",
  "PRELIMINARY_OFFER",
  "AGREED_OFFER",
  "CONTRACT_CONFIG",
  "PRODUCTION_TASK",
  "PRODUCTION",
  "INSTALLATION",
  "COMPLETED",
] as const;
export type RevisionStatus = (typeof REVISION_STATUSES)[number];

export const MATERIAL_STATUSES = [
  "CONFIRMED",
  "PER_DRAWING_NEEDS_CHECK",
  "PRELIMINARY_BY_ANALOGY",
  "PRICE_NEEDED",
  "SIZE_NEEDED",
  "VERSION_CONFLICT",
  "NOT_IN_ORDER",
  "INCLUDED_IN_PACKAGE",
  "REPLACED",
] as const;
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

export const EXPORT_KINDS = [
  "CLIENT_PDF",
  "CLIENT_DOCX",
  "OWNER_XLSX",
  "PRODUCTION_PDF",
  "PRODUCTION_XLSX",
  "JSON",
] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];
