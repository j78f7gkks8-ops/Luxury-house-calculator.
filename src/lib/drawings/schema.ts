import { z } from "zod";

/**
 * A drawing revision: facts transcribed from a set of architectural sheets.
 *
 * This sits ABOVE the website catalog in the source priority of §6 ("утверждённая
 * версия спецификации/схемы" beats "предварительная оценка по аналогу"), but it
 * is still not a production BOM: every block carries its own status, and what
 * the sheets do not state stays unstated.
 */

export const factStatusSchema = z.enum([
  "CONFIRMED",
  "PARTIAL",
  "PER_DRAWING_NEEDS_CHECK",
  "SIZE_NEEDED",
]);

export const roomSchema = z.object({
  no: z.number(),
  name: z.string(),
  area_m2: z.number(),
  kind: z.enum(["indoor", "terrace", "porch", "canopy"]),
});

export const drawingRevisionSchema = z.object({
  schema_version: z.string(),
  drawing_revision_id: z.string().min(1),
  project_id: z.string().min(1),
  model_name: z.string(),

  source: z.object({
    file: z.string(),
    sha256: z.string(),
    sheets_in_file: z.array(z.number()),
    sheet_titles: z.array(z.string()),
    producer: z.string().nullable().optional(),
    received_at: z.string(),
    review_status: z.string(),
    note: z.string().optional(),
  }),

  envelope: z.object({
    overall_length_mm: z.number(),
    overall_depth_mm: z.number(),
    living_part_length_mm: z.number(),
    terrace_length_mm: z.number(),
    internal_clear_depth_mm: z.number(),
    derived_exterior_wall_thickness_mm: z.number(),
    wall_thickness_derivation: z.string(),
    status: factStatusSchema,
    source_sheet: z.number(),
  }),

  modules: z.object({
    bay_pitch_mm: z.number(),
    bay_count: z.number(),
    living_module_count: z.number(),
    terrace_module_count: z.number(),
    module_footprint_mm: z.tuple([z.number(), z.number()]),
    status: factStatusSchema,
    source_sheet: z.number(),
    note: z.string().optional(),
  }),

  room_schedule: z.object({
    title: z.string(),
    source_sheet: z.number(),
    status: factStatusSchema,
    measurement_note: z.string().optional(),
    rooms: z.array(roomSchema),
    drawing_stated_total_m2: z.number(),
  }),

  porch: z.object({
    width_mm: z.number(),
    depth_mm: z.number(),
    area_m2: z.number(),
    status: factStatusSchema,
    source_sheet: z.number(),
    note: z.string().optional(),
  }),

  levels_m: z.object({
    finished_floor: z.number(),
    plinth_bottom: z.number(),
    window_sill: z.number(),
    opening_head: z.number(),
    eave_low_side: z.number(),
    eave_high_side: z.number(),
    ridge: z.number(),
    status: factStatusSchema,
    source_sheets: z.array(z.number()),
    datum_note: z.string().optional(),
  }),

  roof: z.object({
    shape: z.string(),
    covering_from_facade: z.string(),
    ridge_runs_along: z.string(),
    span_mm: z.number(),
    rise_from_high_eave_mm: z.number(),
    rise_from_low_eave_mm: z.number(),
    /** null = the sheets do not state it; never guessed into a number. */
    slope_deg: z.number().nullable(),
    slope_status: factStatusSchema,
    slope_note: z.string(),
    status: factStatusSchema,
    source_sheets: z.array(z.number()),
  }),

  facade: z.object({
    materials: z.array(z.string()),
    composition: z.string(),
    status: factStatusSchema,
    source_sheets: z.array(z.number()),
    note: z.string().optional(),
  }),

  openings_from_dimension_chains: z.record(z.unknown()),

  conflicts: z.array(
    z.object({
      code: z.string(),
      severity: z.enum(["info", "important", "blocking"]),
      message: z.string(),
      sources: z.array(z.string()),
    }),
  ),

  still_missing_for_costing: z.record(z.string()),
});

export type DrawingRevision = z.infer<typeof drawingRevisionSchema>;
export type DrawingRoom = z.infer<typeof roomSchema>;
