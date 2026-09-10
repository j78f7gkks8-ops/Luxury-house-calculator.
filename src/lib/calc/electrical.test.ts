import { describe, expect, it } from "vitest";
import { checkPanelCapacity, frameCount } from "./electrical";
import { CalcError } from "./money";

describe("electrical panel", () => {
  it("acceptance #24 / §13: a 24-module panel does not accept a set already taking 36", () => {
    const devices = [
      { name: "Вводной автомат 2P", modules: 2, qty: 1 },
      { name: "УЗО 2P", modules: 2, qty: 2 },
      { name: "Автомат 1P", modules: 1, qty: 20 },
      { name: "Дифавтомат 2P", modules: 2, qty: 5 },
    ];
    const result = checkPanelCapacity(devices, 24, 0);

    expect(result.usedModules).toBe(36); // 2 + 4 + 20 + 10
    expect(result.fits).toBe(false);
    expect(result.shortfallModules).toBe(12);
    expect(result.message).toContain("не вмещает");
  });

  it("required modules = devices + reserve, and the reserve can tip a panel over", () => {
    const devices = [{ name: "Автомат 1P", modules: 1, qty: 20 }];
    expect(checkPanelCapacity(devices, 24, 0).fits).toBe(true);
    // the same set with the owner's 6-module reserve no longer fits
    const withReserve = checkPanelCapacity(devices, 24, 6);
    expect(withReserve.requiredModules).toBe(26);
    expect(withReserve.fits).toBe(false);
    expect(withReserve.shortfallModules).toBe(2);
  });

  it("a sufficient panel reports no conflict", () => {
    const result = checkPanelCapacity([{ name: "Автомат 1P", modules: 1, qty: 10 }], 24, 6);
    expect(result.fits).toBe(true);
    expect(result.shortfallModules).toBe(0);
    expect(result.message).toBeUndefined();
  });

  it("§13: frame count follows the grouping of mechanisms, not their number", () => {
    // 5 mechanisms grouped as 2 + 2 + 1 make three frames, not five
    expect(frameCount([2, 2, 1])).toBe(3);
    expect(frameCount([1, 1, 1, 1, 1])).toBe(5);
  });

  it("rejects an invalid panel or device instead of guessing", () => {
    expect(() => checkPanelCapacity([], 0)).toThrow(CalcError);
    expect(() => checkPanelCapacity([{ name: "x", modules: 0, qty: 1 }], 24)).toThrow(CalcError);
  });
});
