import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseCatalog } from "../../catalog/parse";
import { buildCatalogProjectSnapshot } from "./catalogProject";
import { CalcError } from "../../calc/money";
import { loadDrawingRevision } from "../../drawings";

const catalog = parseCatalog(
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/catalog/Luxury_House_Projects_Catalog.json"), "utf8")),
);
const byId = new Map(catalog.projects.map((p) => [p.project_id, p]));

describe("catalog-driven preliminary estimate", () => {
  it("rule 10: never invents a pile count - the field stays unknown with a reason", () => {
    const snapshot = buildCatalogProjectSnapshot(byId.get("lh_house_norma63")!, { selectedOptionIds: [] });
    expect(snapshot.pileSummary.totalPiles).toBeNull();
    expect(snapshot.pileSummary.bindingLengthMm).toBeNull();
    expect(snapshot.pileSummary.source).toContain("схема");

    const pileGap = snapshot.compositionLines.find((l) => l.key === "gap:pile_count");
    expect(pileGap).toBeDefined();
    expect(pileGap!.qty).toBeNull(); // unknown, not 0
    expect(pileGap!.status).toBe("SIZE_NEEDED");
  });

  it("rule 15: the result is marked preliminary and its sum is never a full cost", () => {
    const snapshot = buildCatalogProjectSnapshot(byId.get("lh_house_norma63")!, { selectedOptionIds: [] });
    expect(snapshot.readiness.level).toBe("CATALOG_PRELIMINARY");
    expect(snapshot.readiness.isFullCost).toBe(false);
    expect(snapshot.readiness.gaps.length).toBeGreaterThan(0);
    expect(snapshot.readiness.assumptions.some((a) => a.includes("Свайное поле"))).toBe(true);
  });

  it("rule 13: refuses to calculate БАРН 48 while its plan contradicts its card", () => {
    expect(() => buildCatalogProjectSnapshot(byId.get("lh_house_barn48")!, { selectedOptionIds: [] })).toThrow(
      CalcError,
    );
  });

  it("rule 16: option quantities come from THIS project's plan, not from Барн 96", () => {
    const norma63 = buildCatalogProjectSnapshot(byId.get("lh_house_norma63")!, {
      selectedOptionIds: ["warm-floor"],
    });
    const barn84 = buildCatalogProjectSnapshot(byId.get("lh_house_barn84")!, {
      selectedOptionIds: ["warm-floor"],
    });

    const screed = (s: typeof norma63) => s.compositionLines.find((l) => l.key === "interior:floor:screed")!.qty;
    expect(screed(norma63)).toBe(35.34); // подписи плана Норма 63
    expect(screed(barn84)).toBe(62.12); // подписи плана Барн 84
    expect(screed(norma63)).not.toBe(screed(barn84));
  });

  it("no options are applied unless explicitly selected (rule 16)", () => {
    const bare = buildCatalogProjectSnapshot(byId.get("lh_house_barn84")!, { selectedOptionIds: [] });
    expect(bare.selectedOptionIds).toEqual([]);
    expect(bare.compositionLines.find((l) => l.key === "interior:floor:screed")).toBeUndefined();
  });

  it("rule 8: a sauna without a published bathroom count is not offered the bathroom-tile option", () => {
    const start = byId.get("lh_sauna_start")!;
    expect(start.website_specs.bathrooms_count).toBeNull();
    const snapshot = buildCatalogProjectSnapshot(start, { selectedOptionIds: ["tile-bathroom"] });
    // the unknown count blocks the option instead of assuming a bathroom exists
    expect(snapshot.selectedOptionIds).not.toContain("tile-bathroom");
  });

  it("rules 4/5: the snapshot carries every area separately with its own definition", () => {
    const snapshot = buildCatalogProjectSnapshot(byId.get("lh_house_barn96")!, { selectedOptionIds: [] });
    const ref = snapshot.catalogRef!;
    expect(ref.advertisedAreaM2).toBe(96);
    expect(ref.labeledIndoorAreaSumM2).toBe(61.23);
    expect(ref.terraceLabeledAreaM2).toBe(22.74);
    expect(ref.enclosedBodyGrossAreaM2).toBe(72);
    expect(ref.planImagePath).toBe("/plans/barn96.jpg");
  });

  it("rule 9: the advertised ceiling height is recorded as an assumption, not as a stud height", () => {
    const snapshot = buildCatalogProjectSnapshot(byId.get("lh_house_norma63")!, { selectedOptionIds: [] });
    expect(snapshot.readiness.assumptions.some((a) => a.includes("не длина стойки"))).toBe(true);
    expect(snapshot.compositionLines.find((l) => l.key === "gap:structural_stud_height_mm")).toBeDefined();
  });

  it("all 19 calculable models produce a preliminary snapshot without throwing", () => {
    const calculable = catalog.projects.filter((p) => p.project_id !== "lh_house_barn48");
    expect(calculable).toHaveLength(19);
    for (const p of calculable) {
      const snapshot = buildCatalogProjectSnapshot(p, { selectedOptionIds: [] });
      expect(snapshot.readiness.isFullCost).toBe(false);
      expect(snapshot.templateId).toBe(`catalog:${p.project_id}`);
    }
  });

  it("maps roof family to the right house family", () => {
    expect(buildCatalogProjectSnapshot(byId.get("lh_house_barn84")!, { selectedOptionIds: [] }).houseFamily).toBe("BARN");
    expect(
      buildCatalogProjectSnapshot(byId.get("lh_house_norma63")!, { selectedOptionIds: [] }).houseFamily,
    ).toBe("NORMA_FLAT_ROOF");
  });
});

describe("client-facing content boundaries (§21, rule 14)", () => {
  const snapshot = buildCatalogProjectSnapshot(byId.get("lh_house_norma63")!, {
    selectedOptionIds: ["warm-floor"],
  });

  it("the client description lists only selected, quantified items - no internal production gaps", () => {
    const items = snapshot.clientDescription.flatMap((b) => b.items).join(" ");
    expect(items).toContain("Стяжка тёплого пола");
    expect(items).not.toContain("Число производственных модулей");
    expect(items).not.toContain("Утверждённая редакция");
  });

  it("source discrepancies stay internal: they are in catalogRef.issues, not in the client-facing gap list", () => {
    expect(snapshot.catalogRef!.issues.length).toBeGreaterThan(0);
    expect(snapshot.readiness.gaps.join(" ")).not.toContain("Расхождение источника");
    expect(snapshot.readiness.gaps.join(" ")).not.toContain("Региональная");
  });
});

describe("a drawing revision upgrades the catalog estimate (§6 source priority)", () => {
  const barn96 = byId.get("lh_house_barn96")!;
  const drawing = loadDrawingRevision("lh_house_barn96")!;

  const fromSite = buildCatalogProjectSnapshot(barn96, { selectedOptionIds: [] });
  const fromDrawing = buildCatalogProjectSnapshot(barn96, { selectedOptionIds: [], drawingRevision: drawing });

  it("records which revision the calculation stands on", () => {
    expect(fromSite.readiness.sourceRevisionId).toBeUndefined();
    expect(fromDrawing.readiness.sourceRevisionId).toBe("barn96_arch_2026_09_sheets_20_23");
  });

  it("closes the gaps the sheets actually answer, and only those", () => {
    expect(fromDrawing.readiness.gaps.length).toBeLessThan(fromSite.readiness.gaps.length);

    const gapKeys = (s: typeof fromSite) => s.compositionLines.filter((l) => l.key.startsWith("gap:")).map((l) => l.key);
    expect(gapKeys(fromSite)).toContain("gap:production_module_count");
    expect(gapKeys(fromDrawing)).not.toContain("gap:production_module_count");
    expect(gapKeys(fromDrawing)).not.toContain("gap:module_geometry");

    // the framing BOM and pile scheme are not in this sheet set, so they remain
    expect(gapKeys(fromDrawing)).toContain("gap:structural_bom");
    expect(gapKeys(fromDrawing)).toContain("gap:pile_count");
  });

  it("still refuses to invent a pile field - a plan is not a pile scheme", () => {
    expect(fromDrawing.pileSummary.totalPiles).toBeNull();
    expect(fromDrawing.readiness.isFullCost).toBe(false);
  });

  it("adds the porch as a real dimensioned line", () => {
    expect(fromSite.compositionLines.find((l) => l.key === "options:porch:deck")).toBeUndefined();
    const porch = fromDrawing.compositionLines.find((l) => l.key === "options:porch:deck")!;
    expect(porch.qty).toBe(2.16);
    expect(porch.status).toBe("CONFIRMED");
    expect(porch.totalCostRub).toBeCloseTo(2.16 * 1750, 2);
  });

  it("attributes quantities to the drawing instead of the website plan", () => {
    const withOption = buildCatalogProjectSnapshot(barn96, {
      selectedOptionIds: ["warm-floor"],
      drawingRevision: drawing,
    });
    const screed = withOption.compositionLines.find((l) => l.key === "interior:floor:screed")!;
    expect(screed.qty).toBe(61.23);
    const floor = withOption.compositionLines.find((l) => l.key === "interior:floor:finish")!;
    expect(floor.source).toContain("Чертёж");
  });

  it("surfaces the drawing's conflicts to the owner without touching the client document", () => {
    const codes = fromDrawing.catalogRef!.issues.map((i) => i.code);
    expect(codes).toContain("ceiling_height_definition");
    expect(codes).toContain("roof_slope_vs_historical_note");

    // client-facing gap list still carries no source-conflict wording
    expect(fromDrawing.readiness.gaps.join(" ")).not.toContain("2,7");
  });
});
