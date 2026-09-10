import { describe, it, expect } from "vitest";
import { buildEstimate } from "../src/domain/estimate/buildEstimate.js";
import type { EstimateSelection } from "../src/domain/estimate/types.js";

function baseSelection(overrides: Partial<EstimateSelection>): EstimateSelection {
  return {
    catalogTemplateId: "custom",
    family: "BARN",
    insideAreaM2: 61.23,
    closedFootprintM2: 72,
    windows: [],
    options: [],
    foundation: { template: "generic_analog" },
    pricing: { mode: "markup", markupK: 0.3, taxRateT: 0.06, managerCommissionM: 0.02 },
    ...overrides,
  };
}

describe("раздел 7.4/7.5: реальная геометрия закрытого контура (Барн 96, пролёт 8×9)", () => {
  it("считает площадь стен/кровли по геометрии, а не по одному коэффициенту ₽/м²", () => {
    const selection = baseSelection({ rectFootprint: { spanM: 8, lengthM: 9 } });
    const result = buildEstimate(selection);
    const shell = result.blocks.find((b) => b.id === "shell")!;

    const wallLine = shell.lines.find((l) => l.id === "wall_area_net")!;
    expect(wallLine.quantity).toBeCloseTo(80.58, 1); // периметр 34 × высота 2.37

    const roofLine = shell.lines.find((l) => l.id === "roof_area")!;
    expect(roofLine.quantity).toBeGreaterThan(72); // скат больше площади застройки
    expect(roofLine.note).toContain("0.633"); // подъём конька по примеру раздела 7.2

    const plankenLine = shell.lines.find((l) => l.id === "facade_planken")!;
    expect(plankenLine.amount).toBeCloseTo(80.58 * 1200, 0);

    expect(shell.subtotal).toBeGreaterThan(0);
  });

  it("окна вычитаются из площади стены (раздел 11.5.1) — считаем окна ПЕРЕД стенами", () => {
    const withoutWindows = buildEstimate(baseSelection({ rectFootprint: { spanM: 8, lengthM: 9 } }));
    const withWindows = buildEstimate(
      baseSelection({
        rectFootprint: { spanM: 8, lengthM: 9 },
        windows: [
          { id: "w1", label: "Окно", productId: "W1", referenceFinish: "white", targetFinish: "white", widthMm: 2100, heightMm: 2200, shape: "rect", qty: 1 },
        ],
      })
    );
    const wallBefore = withoutWindows.blocks.find((b) => b.id === "shell")!.lines.find((l) => l.id === "wall_area_net")!.quantity!;
    const wallAfter = withWindows.blocks.find((b) => b.id === "shell")!.lines.find((l) => l.id === "wall_area_net")!.quantity!;
    expect(wallBefore - wallAfter).toBeCloseTo(2.1 * 2.2, 3);
  });
});

describe("раздел 7.4: Г-образный/составной контур не подменяется прямоугольником", () => {
  it("без rectFootprint остаётся только оценка каркаса по аналогу и явный gap", () => {
    const result = buildEstimate(baseSelection({ family: "NORMA", rectFootprint: null }));
    const shell = result.blocks.find((b) => b.id === "shell")!;
    expect(shell.lines.find((l) => l.id === "wall_area_net")).toBeUndefined();
    expect(shell.lines.find((l) => l.id === "shell_framing_analog")).toBeDefined();
    expect(result.gaps.some((g) => g.code === "shell_geometry_not_rectangular")).toBe(true);
  });
});

describe("раздел 7.3: Норма без подтверждённой высоты стены не выдумывает число", () => {
  it("прямоугольная Норма без wallHeight/cleanCeilingHeightMm даёт needs_size, не 0", () => {
    const result = buildEstimate(baseSelection({ family: "NORMA", rectFootprint: { spanM: 7, lengthM: 6 } }));
    const shell = result.blocks.find((b) => b.id === "shell")!;
    const blockedLine = shell.lines.find((l) => l.id === "wall_area_blocked")!;
    expect(blockedLine.status).toBe("needs_size");
    expect(blockedLine.amount).toBeNull();
    expect(result.gaps.some((g) => g.code === "wall_height_missing")).toBe(true);
  });
});
