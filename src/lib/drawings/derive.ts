import { CalcError } from "../calc/money";
import { mm2ToM2, mmToM } from "../calc/units";
import { DrawingRevision } from "./schema";

/**
 * Quantities that follow strictly from a drawing revision.
 *
 * Anything the sheets do not fix stays `null` with a reason rather than being
 * completed by assumption - notably the gable triangles, which need the ridge
 * position, and every sloped roof area, which needs the pitch.
 */

export interface DerivedGeometry {
  /** 12,0 x 8,0 = 96,00 m2 - this is what the model's name and the site's "площадь" mean. */
  envelopeGrossAreaM2: number;
  /** Living part by its outer contour, 9,0 x 8,0 = 72 m2. */
  livingGrossAreaM2: number;
  terraceGrossAreaM2: number;
  /** Sum of the labelled indoor rooms only. */
  labeledIndoorAreaM2: number;
  labeledTerraceAreaM2: number;
  labeledPorchAreaM2: number;
  /** The schedule's own total, as printed on the sheet. */
  drawingStatedTotalM2: number;
  /** Outer perimeter of the living part - the base for the skirt (§15). */
  livingOuterPerimeterM: number;
  /** Wall height up to the eaves; the gable above it is separate. */
  wallHeightToEaveM: number;
  /**
   * Rectangular part of the exterior walls (perimeter x eave height). The two
   * gable triangles are NOT included - see gableAreaM2.
   */
  rectangularWallAreaM2: number;
  /**
   * null: the ridge position along the 8 m span is not dimensioned on these
   * sheets, so the triangle cannot be split honestly.
   */
  gableAreaM2: number | null;
  gableAreaBlockedReason: string | null;
  /** null while the pitch is unstated - a sloped area needs it. */
  roofSlopedAreaM2: number | null;
  roofSlopedAreaBlockedReason: string | null;
}

export function deriveGeometry(revision: DrawingRevision): DerivedGeometry {
  const env = revision.envelope;
  if (env.overall_length_mm <= 0 || env.overall_depth_mm <= 0) {
    throw new CalcError("Некорректный габарит в чертежной редакции", "INVALID_DRAWING_ENVELOPE");
  }

  const rooms = revision.room_schedule.rooms;
  const sumBy = (kind: string) =>
    rooms.filter((r) => r.kind === kind).reduce((s, r) => s + r.area_m2, 0);

  const livingOuterPerimeterM =
    2 * (mmToM(env.living_part_length_mm) + mmToM(env.overall_depth_mm));
  const wallHeightToEaveM = revision.levels_m.eave_high_side - revision.levels_m.finished_floor;

  const pitchUnknown = revision.roof.slope_deg === null;

  return {
    envelopeGrossAreaM2: mm2ToM2(env.overall_length_mm * env.overall_depth_mm),
    livingGrossAreaM2: mm2ToM2(env.living_part_length_mm * env.overall_depth_mm),
    terraceGrossAreaM2: mm2ToM2(env.terrace_length_mm * env.overall_depth_mm),
    labeledIndoorAreaM2: Number(sumBy("indoor").toFixed(2)),
    labeledTerraceAreaM2: Number(sumBy("terrace").toFixed(2)),
    labeledPorchAreaM2: Number(sumBy("porch").toFixed(2)),
    drawingStatedTotalM2: revision.room_schedule.drawing_stated_total_m2,
    livingOuterPerimeterM,
    wallHeightToEaveM,
    rectangularWallAreaM2: Number((livingOuterPerimeterM * wallHeightToEaveM).toFixed(2)),
    gableAreaM2: null,
    gableAreaBlockedReason:
      "Положение конька вдоль пролёта 8 000 на листах не подписано - площадь фронтонов не выводится однозначно.",
    roofSlopedAreaM2: null,
    roofSlopedAreaBlockedReason: pitchUnknown
      ? "Уклон кровли на листах не указан - площадь по скату не считается."
      : null,
  };
}

/** Cross-check: the schedule's printed total must equal the sum of its own rows. */
export function roomScheduleTotalsAgree(revision: DrawingRevision): {
  agree: boolean;
  computedTotalM2: number;
  statedTotalM2: number;
} {
  const computed = Number(
    revision.room_schedule.rooms.reduce((s, r) => s + r.area_m2, 0).toFixed(2),
  );
  return {
    agree: Math.abs(computed - revision.room_schedule.drawing_stated_total_m2) < 0.01,
    computedTotalM2: computed,
    statedTotalM2: revision.room_schedule.drawing_stated_total_m2,
  };
}

/**
 * Which of the catalog's `missing_for_costing` fields this drawing revision
 * actually closes. Everything else stays open.
 */
export function closedCostingGaps(revision: DrawingRevision): string[] {
  const closed: string[] = [];
  if (revision.modules.status === "CONFIRMED") {
    closed.push("production_module_count", "module_geometry");
  }
  if (revision.envelope.status === "CONFIRMED" && revision.room_schedule.status === "CONFIRMED") {
    closed.push("approved_revision_id");
  }
  return closed;
}
