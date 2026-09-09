import { BLOCKED_REVIEW_STATUSES, Catalog, CatalogProject, catalogSchema } from "./schema";

/**
 * Pure parsing/mapping for the site catalog. No database and no network here,
 * so the import rules can be tested directly.
 */

/** Keys that would indicate site pricing leaking into the import (rule 3). */
const PRICE_KEY_PATTERN = /(price|cost|rub|стоим|цена|₽)/i;

/**
 * `missing_for_costing` names what the site cannot give FOR costing; it holds
 * only nulls, not prices. It is the one key allowed to match the pattern.
 */
const PRICE_KEY_ALLOWLIST = new Set(["missing_for_costing"]);

/** Currency markers in string values - a snapshot that starts carrying site prices must fail loudly. */
const PRICE_VALUE_PATTERN = /(₽|руб\.?\b|цена|стоимост)/i;

export class CatalogImportError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CatalogImportError";
  }
}

/**
 * Rule 3: the catalog must carry no prices. We do not merely trust the
 * `pricing_data_included: false` flag - we check the payload for price-like
 * keys, so a future snapshot that starts shipping prices fails the import
 * loudly instead of quietly seeding the calculator with website numbers.
 */
export function assertNoPricingData(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoPricingData(v, `${path}[${i}]`));
    return;
  }
  if (typeof value === "string") {
    if (PRICE_VALUE_PATTERN.test(value)) {
      throw new CatalogImportError(
        `Каталог содержит ценовое значение (${path}) - цены сайта не импортируются`,
        "PRICING_DATA_IN_CATALOG",
        { path },
      );
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (PRICE_KEY_PATTERN.test(key) && !PRICE_KEY_ALLOWLIST.has(key)) {
        throw new CatalogImportError(
          `Каталог содержит ценовое поле "${key}" (${path}) - цены сайта не импортируются`,
          "PRICING_DATA_IN_CATALOG",
          { path, key },
        );
      }
      assertNoPricingData(child, `${path}.${key}`);
    }
  }
}

export function parseCatalog(raw: unknown): Catalog {
  const parsed = catalogSchema.parse(raw);
  assertNoPricingData(parsed.projects);

  const seen = new Set<string>();
  for (const p of parsed.projects) {
    if (seen.has(p.project_id)) {
      throw new CatalogImportError(
        `Дубликат project_id "${p.project_id}" в каталоге`,
        "DUPLICATE_PROJECT_ID",
        { projectId: p.project_id },
      );
    }
    seen.add(p.project_id);
  }
  return parsed;
}

/**
 * Rule 13 / review_status: a plan that contradicts its own card must not drive
 * a calculation until it is confirmed.
 */
export function isBlockedForCalculation(p: CatalogProject): boolean {
  return (BLOCKED_REVIEW_STATUSES as readonly string[]).includes(p.floor_plan.review_status);
}

/**
 * Rules 4 and 5: areas are kept as separate, individually-sourced figures.
 * There is deliberately no "the area" accessor - callers must pick the one
 * they mean and show its definition.
 */
export interface CatalogAreas {
  advertisedAreaM2: number | null;
  areaDefinition: string | null;
  labeledIndoorAreaSumM2: number | null;
  labeledOutdoorAreaSumM2: number | null;
  terraceLabeledAreaM2: number | null;
  enclosedBodyGrossAreaM2: number | null;
}

export function catalogAreas(p: CatalogProject): CatalogAreas {
  return {
    advertisedAreaM2: p.website_specs.advertised_area_m2,
    areaDefinition: p.website_specs.area_definition,
    labeledIndoorAreaSumM2: p.floor_plan.derived_labeled_indoor_area_sum_m2,
    labeledOutdoorAreaSumM2: p.floor_plan.derived_labeled_outdoor_area_sum_m2,
    terraceLabeledAreaM2: p.floor_plan.terrace_labeled_area_m2,
    enclosedBodyGrossAreaM2: p.floor_plan.enclosed_body_gross_area_from_dimensions_m2,
  };
}

/**
 * Rule 5 sanity check: the advertised figure and the sum of labelled areas are
 * different definitions, so a mismatch is reported as information, never
 * silently reconciled (e.g. СТАНДАРТ 1: 22.16 vs 24.77).
 */
export function advertisedVsLabeledDeltaM2(p: CatalogProject): number | null {
  const advertised = p.website_specs.advertised_area_m2;
  const labeledAll = p.floor_plan.derived_all_labeled_area_sum_m2;
  if (advertised === null || labeledAll === null) return null;
  return Number((labeledAll - advertised).toFixed(2));
}

/** Fields the site cannot supply for full costing - kept as an explicit list. */
export function missingForCostingKeys(p: CatalogProject): string[] {
  return Object.entries(p.missing_for_costing)
    .filter(([, v]) => v === null || v === undefined)
    .map(([k]) => k);
}

export interface HouseProjectRow {
  projectId: string;
  websiteSlug: string;
  displayName: string;
  nameAliasesJson: string;
  category: string;
  series: string | null;
  sourceUrl: string;
  catalogUrl: string | null;
  snapshotDate: string;
  advertisedAreaM2: number | null;
  areaDefinition: string | null;
  ceilingHeightM: number | null;
  roofText: string | null;
  roofFamilyHint: string | null;
  bedroomsCount: number | null;
  bathroomsCount: number | null;
  featureLinesJson: string;
  floorPlanFile: string | null;
  floorPlanSourceUrl: string | null;
  floorPlanSha256: string | null;
  floorPlanReviewStatus: string;
  dimensionedEnvelopeMmJson: string | null;
  envelopeIsFullFootprint: boolean;
  enclosedBodyMmJson: string | null;
  enclosedBodyGrossAreaM2: number | null;
  dimensionsNotes: string | null;
  roomsJson: string;
  outdoorZonesJson: string;
  labeledIndoorAreaSumM2: number | null;
  labeledOutdoorAreaSumM2: number | null;
  terraceLabeledAreaM2: number | null;
  areaUse: string | null;
  missingForCostingJson: string;
  issuesJson: string;
  coverImageUrl: string | null;
  galleryUrlsJson: string;
  rawJson: string;
  approvedTemplateId: string | null;
}

/**
 * Owner-approved calculation templates that correspond to a catalog model.
 * The link is one-way: selecting a catalog project can offer the approved
 * template, but the site snapshot never overwrites the owner's norms (rule 12).
 */
export const APPROVED_TEMPLATE_BY_PROJECT_ID: Record<string, string> = {
  lh_house_barn96: "barn-96-kyzyl",
  lh_house_norma77: "norma-77-v2",
};

export function toHouseProjectRow(p: CatalogProject): HouseProjectRow {
  return {
    projectId: p.project_id,
    websiteSlug: p.website_slug,
    displayName: p.display_name,
    nameAliasesJson: JSON.stringify(p.name_aliases),
    category: p.category,
    series: p.series_from_page_heading,
    sourceUrl: p.source_url,
    catalogUrl: p.catalog_url,
    snapshotDate: p.snapshot_date,
    advertisedAreaM2: p.website_specs.advertised_area_m2,
    areaDefinition: p.website_specs.area_definition,
    ceilingHeightM: p.website_specs.ceiling_height_m,
    roofText: p.website_specs.roof_text,
    roofFamilyHint: p.website_specs.roof_family_hint,
    bedroomsCount: p.website_specs.bedrooms_count,
    bathroomsCount: p.website_specs.bathrooms_count,
    featureLinesJson: JSON.stringify(p.website_specs.feature_lines),
    floorPlanFile: p.floor_plan.file_in_bundle,
    floorPlanSourceUrl: p.floor_plan.source_url,
    floorPlanSha256: p.floor_plan.sha256,
    floorPlanReviewStatus: p.floor_plan.review_status,
    dimensionedEnvelopeMmJson: p.floor_plan.dimensioned_envelope_mm
      ? JSON.stringify(p.floor_plan.dimensioned_envelope_mm)
      : null,
    envelopeIsFullFootprint: p.floor_plan.dimensioned_envelope_is_full_footprint,
    enclosedBodyMmJson: p.floor_plan.rectangular_enclosed_body_mm
      ? JSON.stringify(p.floor_plan.rectangular_enclosed_body_mm)
      : null,
    enclosedBodyGrossAreaM2: p.floor_plan.enclosed_body_gross_area_from_dimensions_m2,
    dimensionsNotes: p.floor_plan.dimensions_notes,
    roomsJson: JSON.stringify(p.floor_plan.rooms),
    outdoorZonesJson: JSON.stringify(p.floor_plan.outdoor_zones),
    labeledIndoorAreaSumM2: p.floor_plan.derived_labeled_indoor_area_sum_m2,
    labeledOutdoorAreaSumM2: p.floor_plan.derived_labeled_outdoor_area_sum_m2,
    terraceLabeledAreaM2: p.floor_plan.terrace_labeled_area_m2,
    areaUse: p.floor_plan.area_use,
    missingForCostingJson: JSON.stringify(p.missing_for_costing),
    issuesJson: JSON.stringify(p.issues),
    coverImageUrl: p.images?.cover_url ?? null,
    galleryUrlsJson: JSON.stringify(p.images?.gallery_urls ?? []),
    rawJson: JSON.stringify(p),
    approvedTemplateId: APPROVED_TEMPLATE_BY_PROJECT_ID[p.project_id] ?? null,
  };
}
