import { z } from "zod";

/**
 * Schema of the lhmodul.ru catalog snapshot (data/catalog/*.json).
 *
 * Everything optional in the source is `.nullable()`, never defaulted: null
 * means "неизвестно", not zero (import rule 8). No price field exists in this
 * schema at all - the catalog carries no prices and the calculator must not
 * accept any (rule 3).
 */

export const roomSchema = z.object({
  name: z.string(),
  area_m2: z.number().nullable(),
  source: z.string(),
});

export const floorPlanSchema = z.object({
  source_url: z.string().nullable(),
  file_in_bundle: z.string().nullable(),
  sha256: z.string().nullable(),
  review_status: z.string(),
  dimensioned_envelope_mm: z.array(z.number()).nullable(),
  dimensioned_envelope_is_full_footprint: z.boolean(),
  rectangular_enclosed_body_mm: z.array(z.number()).nullable(),
  enclosed_body_gross_area_from_dimensions_m2: z.number().nullable(),
  dimensions_notes: z.string().nullable(),
  rooms: z.array(roomSchema),
  outdoor_zones: z.array(roomSchema),
  derived_labeled_indoor_area_sum_m2: z.number().nullable(),
  derived_labeled_outdoor_area_sum_m2: z.number().nullable(),
  derived_all_labeled_area_sum_m2: z.number().nullable(),
  terrace_labeled_area_m2: z.number().nullable(),
  area_use: z.string().nullable(),
});

export const websiteSpecsSchema = z.object({
  advertised_area_m2: z.number().nullable(),
  area_definition: z.string().nullable(),
  ceiling_height_m: z.number().nullable(),
  roof_text: z.string().nullable(),
  roof_family_hint: z.string().nullable(),
  bedrooms_count: z.number().nullable(),
  bathrooms_count: z.number().nullable(),
  feature_lines: z.array(z.string()),
});

export const issueSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const catalogProjectSchema = z.object({
  project_id: z.string().min(1),
  website_slug: z.string(),
  display_name: z.string(),
  category: z.enum(["house", "sauna"]),
  series_from_page_heading: z.string().nullable(),
  name_aliases: z.array(z.string()),
  source_url: z.string(),
  catalog_url: z.string().nullable(),
  snapshot_date: z.string(),
  website_specs: websiteSpecsSchema,
  floor_plan: floorPlanSchema,
  missing_for_costing: z.record(z.unknown()),
  issues: z.array(issueSchema).default([]),
  images: z
    .object({
      cover_url: z.string().nullable(),
      gallery_urls: z.array(z.string()),
    })
    .nullable()
    .optional(),
});

export const catalogSchema = z.object({
  schema_version: z.string(),
  catalog_id: z.string(),
  title: z.string(),
  snapshot_date: z.string(),
  import_rules: z.array(z.string()),
  projects: z.array(catalogProjectSchema),
  pricing_data_included: z.literal(false),
});

export type CatalogProject = z.infer<typeof catalogProjectSchema>;
export type Catalog = z.infer<typeof catalogSchema>;

/** Plan transcription statuses that must never drive a calculation (rule 13). */
export const BLOCKED_REVIEW_STATUSES = ["conflict_do_not_use"] as const;
