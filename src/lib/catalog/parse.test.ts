import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  advertisedVsLabeledDeltaM2,
  assertNoPricingData,
  catalogAreas,
  CatalogImportError,
  isBlockedForCalculation,
  missingForCostingKeys,
  parseCatalog,
  toHouseProjectRow,
  APPROVED_TEMPLATE_BY_PROJECT_ID,
} from "./parse";

const raw = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data/catalog/Luxury_House_Projects_Catalog.json"), "utf8"),
);
const catalog = parseCatalog(raw);
const byId = new Map(catalog.projects.map((p) => [p.project_id, p]));

describe("catalog import rules", () => {
  it("rule 2: imports exactly 20 projects with unique stable ids (13 houses + 7 saunas)", () => {
    expect(catalog.projects).toHaveLength(20);
    expect(new Set(catalog.projects.map((p) => p.project_id)).size).toBe(20);
    expect(catalog.projects.filter((p) => p.category === "house")).toHaveLength(13);
    expect(catalog.projects.filter((p) => p.category === "sauna")).toHaveLength(7);
  });

  it("rule 2: mapping to a DB row is keyed by project_id, so re-import updates rather than duplicates", () => {
    const first = toHouseProjectRow(byId.get("lh_house_barn96")!);
    const second = toHouseProjectRow(byId.get("lh_house_barn96")!);
    expect(first.projectId).toBe("lh_house_barn96");
    expect(second).toEqual(first);
  });

  it("rule 3: the catalog carries no prices, and a price field would fail the import", () => {
    expect(raw.pricing_data_included).toBe(false);
    expect(() => assertNoPricingData(catalog.projects)).not.toThrow();

    expect(() => assertNoPricingData({ project_id: "x", price_rub: 100 })).toThrow(CatalogImportError);
    expect(() => assertNoPricingData({ feature_lines: ["Цена: 1 200 000 ₽"] })).toThrow(CatalogImportError);
  });

  it("rule 4/5: advertised area and plan-labelled areas stay separate fields, never merged", () => {
    const barn96 = catalogAreas(byId.get("lh_house_barn96")!);
    // 96 м² на карточке - это габарит с террасой; подписи внутри дают 61,23 м².
    expect(barn96.advertisedAreaM2).toBe(96);
    expect(barn96.labeledIndoorAreaSumM2).toBe(61.23);
    expect(barn96.terraceLabeledAreaM2).toBe(22.74);
    expect(barn96.advertisedAreaM2).not.toBe(barn96.labeledIndoorAreaSumM2);
  });

  it("rule 5: СТАНДАРТ 1 area conflict is surfaced as a delta, not silently reconciled", () => {
    const standart1 = byId.get("lh_sauna_standart1")!;
    // карточка 22,16 м², сумма подписей 24,77 м²
    expect(advertisedVsLabeledDeltaM2(standart1)).toBeCloseTo(2.61, 2);
    expect(standart1.issues.length).toBeGreaterThan(0);
  });

  it("rule 8: null means unknown and is preserved, never turned into 0", () => {
    const barn88 = byId.get("lh_house_barn88")!;
    expect(barn88.website_specs.ceiling_height_m).toBeNull();
    expect(toHouseProjectRow(barn88).ceilingHeightM).toBeNull();

    const norma32 = byId.get("lh_house_norma32")!;
    // карточка не называет спальни - это неизвестно, а не «спален нет»
    expect(norma32.website_specs.bedrooms_count).toBeNull();
    expect(toHouseProjectRow(norma32).bedroomsCount).toBeNull();
  });

  it("rule 10: nothing in the imported row offers a pile count or pile coordinates", () => {
    for (const p of catalog.projects) {
      expect(p.missing_for_costing.pile_count).toBeNull();
      expect(p.missing_for_costing.pile_coordinates).toBeNull();
      const row = toHouseProjectRow(p);
      expect(Object.keys(row)).not.toContain("pileCount");
    }
  });

  it("rule 13: БАРН 48 is blocked for calculation until its plan conflict is resolved", () => {
    const barn48 = byId.get("lh_house_barn48")!;
    expect(barn48.floor_plan.review_status).toBe("conflict_do_not_use");
    expect(isBlockedForCalculation(barn48)).toBe(true);
    expect(barn48.issues[0]!.code).toBe("plan_conflict");

    // every other model stays usable for a preliminary calculation
    const others = catalog.projects.filter((p) => p.project_id !== "lh_house_barn48");
    expect(others.every((p) => !isBlockedForCalculation(p))).toBe(true);
  });

  it("rule 13: project 107 keeps both of its published names", () => {
    const p107 = byId.get("lh_house_barn107")!;
    expect(p107.display_name).toBe("НОРМА 107");
    expect(p107.name_aliases).toContain("БАРН 107");
    expect(JSON.parse(toHouseProjectRow(p107).nameAliasesJson)).toContain("БАРН 107");
    expect(p107.website_specs.roof_text).toBe("односкатная/плоская");
  });

  it("every model declares the same 12 costing gaps the website cannot fill", () => {
    for (const p of catalog.projects) {
      expect(missingForCostingKeys(p)).toHaveLength(12);
    }
  });

  it("rule 12: only models with an owner-approved template are linked to one", () => {
    expect(toHouseProjectRow(byId.get("lh_house_barn96")!).approvedTemplateId).toBe("barn-96-kyzyl");
    expect(toHouseProjectRow(byId.get("lh_house_norma32")!).approvedTemplateId).toBeNull();
    expect(Object.keys(APPROVED_TEMPLATE_BY_PROJECT_ID).length).toBeLessThan(catalog.projects.length);
  });

  it("rejects a catalog with duplicate project ids", () => {
    const dup = { ...raw, projects: [raw.projects[0], raw.projects[0]] };
    expect(() => parseCatalog(dup)).toThrow(CatalogImportError);
  });

  it("every project points at a plan image that exists in the bundle", () => {
    for (const p of catalog.projects) {
      const file = p.floor_plan.file_in_bundle;
      expect(file).toBeTruthy();
      expect(fs.existsSync(path.join(process.cwd(), "public", file!))).toBe(true);
    }
  });
});
