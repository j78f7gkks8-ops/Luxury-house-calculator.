import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { loadDrawingRevision, hasDrawingRevision } from "./index";
import { deriveGeometry, roomScheduleTotalsAgree, closedCostingGaps } from "./derive";
import { skirtAreaM2 } from "../calc/siteStructures";

const revision = loadDrawingRevision("lh_house_barn96")!;

describe("Барн 96 drawing revision (sheets 20-23)", () => {
  it("loads and validates, and only models with drawings have one", () => {
    expect(revision.drawing_revision_id).toBe("barn96_arch_2026_09_sheets_20_23");
    expect(hasDrawingRevision("lh_house_barn96")).toBe(true);
    expect(hasDrawingRevision("lh_house_norma63")).toBe(false);
    expect(loadDrawingRevision("lh_house_norma63")).toBeNull();
  });

  it("the source PDF is stored in the repo and its hash matches the recorded one", async () => {
    const filePath = path.join(process.cwd(), revision.source.file);
    expect(fs.existsSync(filePath)).toBe(true);

    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
    expect(hash).toBe(revision.source.sha256);
  });

  it("sheet 20: the room schedule adds up to its own printed total of 86,13 m2", () => {
    const check = roomScheduleTotalsAgree(revision);
    expect(check.statedTotalM2).toBe(86.13);
    expect(check.computedTotalM2).toBe(86.13);
    expect(check.agree).toBe(true);
  });

  it("sheet 20: indoor rooms sum to 61,23 m2 - confirming the catalog and §Б1 independently", () => {
    const g = deriveGeometry(revision);
    expect(g.labeledIndoorAreaM2).toBe(61.23);
    expect(g.labeledTerraceAreaM2).toBe(22.74);
    expect(g.labeledPorchAreaM2).toBe(2.16);
    // 61,23 + 22,74 + 2,16 = 86,13
    expect(g.labeledIndoorAreaM2 + g.labeledTerraceAreaM2 + g.labeledPorchAreaM2).toBeCloseTo(86.13, 2);
  });

  it("explains the advertised 96 m2: it is the 12,0 x 8,0 envelope, terrace included", () => {
    const g = deriveGeometry(revision);
    expect(g.envelopeGrossAreaM2).toBe(96);
    expect(g.livingGrossAreaM2).toBe(72); // matches the catalog's enclosed body area
    expect(g.terraceGrossAreaM2).toBe(24);
    // three different definitions, none equal to another
    expect(new Set([g.envelopeGrossAreaM2, g.drawingStatedTotalM2, g.labeledIndoorAreaM2]).size).toBe(3);
  });

  it("sheet 20: module layout is four 3000 bays - three living plus one terrace", () => {
    expect(revision.modules.bay_pitch_mm).toBe(3000);
    expect(revision.modules.bay_count).toBe(4);
    expect(revision.modules.living_module_count).toBe(3);
    expect(revision.modules.terrace_module_count).toBe(1);
    expect(revision.modules.bay_pitch_mm * revision.modules.bay_count).toBe(
      revision.envelope.overall_length_mm,
    );
  });

  it("sheet 21: the porch is 1800 x 1200 = 2,16 m2, matching the schedule", () => {
    expect(revision.porch.width_mm).toBe(1800);
    expect(revision.porch.depth_mm).toBe(1200);
    expect((revision.porch.width_mm / 1000) * (revision.porch.depth_mm / 1000)).toBeCloseTo(2.16, 4);
  });

  it("sheet 21: wall thickness is derived from the chains (8000 - 7580) / 2 = 210 mm", () => {
    const { overall_depth_mm, internal_clear_depth_mm, derived_exterior_wall_thickness_mm } =
      revision.envelope;
    expect((overall_depth_mm - internal_clear_depth_mm) / 2).toBe(derived_exterior_wall_thickness_mm);
  });

  it("sheets 22-23: levels are recorded as given, and the roof pitch stays unknown", () => {
    expect(revision.levels_m.finished_floor).toBe(0);
    expect(revision.levels_m.eave_high_side).toBe(2.37);
    expect(revision.levels_m.eave_low_side).toBe(2.169);
    expect(revision.levels_m.ridge).toBe(3.3);

    // the sheets never print an angle, so it must not be invented
    expect(revision.roof.slope_deg).toBeNull();
    expect(revision.roof.slope_status).toBe("SIZE_NEEDED");
  });

  it("derives the rectangular wall area but refuses the gable and sloped-roof areas", () => {
    const g = deriveGeometry(revision);
    expect(g.livingOuterPerimeterM).toBe(34); // 2 x (9 + 8)
    expect(g.wallHeightToEaveM).toBe(2.37);
    expect(g.rectangularWallAreaM2).toBeCloseTo(80.58, 2);

    // both need data the sheets do not carry
    expect(g.gableAreaM2).toBeNull();
    expect(g.gableAreaBlockedReason).toContain("конька");
    expect(g.roofSlopedAreaM2).toBeNull();
    expect(g.roofSlopedAreaBlockedReason).toContain("Уклон");
  });

  it("feeds the skirt calculation a real outer perimeter instead of a guess", () => {
    const g = deriveGeometry(revision);
    // §15: skirt follows the outer contour; 34 m x 0,3 m plinth shown on the facades
    const plinthHeightM = revision.levels_m.finished_floor - revision.levels_m.plinth_bottom;
    expect(plinthHeightM).toBeCloseTo(0.3, 6);
    expect(skirtAreaM2(g.livingOuterPerimeterM, plinthHeightM)).toBeCloseTo(10.2, 2);
  });

  it("records the ceiling-height conflict rather than trusting the advertised 2,7 m", () => {
    const conflict = revision.conflicts.find((c) => c.code === "ceiling_height_definition");
    expect(conflict).toBeDefined();
    expect(conflict!.severity).toBe("important");
    expect(conflict!.message).toContain("2,7");
  });

  it("records that the historical 9-degree note does not reconcile with these marks", () => {
    const conflict = revision.conflicts.find((c) => c.code === "roof_slope_vs_historical_note");
    expect(conflict).toBeDefined();
    expect(conflict!.message).toContain("9°");
  });

  it("closes only the costing gaps it genuinely closes", () => {
    const closed = closedCostingGaps(revision);
    expect(closed).toContain("production_module_count");
    expect(closed).toContain("module_geometry");
    // the framing BOM sheet is not in this file, so it stays open
    expect(closed).not.toContain("structural_bom");
    expect(closed).not.toContain("pile_count");
    expect(Object.keys(revision.still_missing_for_costing)).toContain("structural_bom");
  });
});
