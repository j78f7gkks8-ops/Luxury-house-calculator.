import { describe, it, expect } from "vitest";
import {
  footprintAreaM2,
  wallPerimeterM,
  grossWallAreaM2,
  barnGableRoofAreaM2,
  netWallAreaM2,
  insulationVolumeM3,
} from "../src/shell.js";

describe("раздел 7.2/7.4: геометрия закрытой части Барна 96 (9×8, пролёт 8)", () => {
  const footprint = { spanM: 8, lengthM: 9 };

  it("площадь застройки 72 м², периметр 34 м", () => {
    expect(footprintAreaM2(footprint).toNumber()).toBe(72);
    expect(wallPerimeterM(footprint).toNumber()).toBe(34);
  });

  it("площадь стен по высоте 2.37 м = 80.58 м²", () => {
    expect(grossWallAreaM2(footprint, 2.37).toNumber()).toBeCloseTo(80.58, 6);
  });

  it("подъём конька при пролёте 8 м и 9° ≈ 0.6335 м (сверка с примером раздела 7.2)", () => {
    const roof = barnGableRoofAreaM2(footprint, 9, 0.3);
    expect(roof.ridgeRiseM.toFixed(4)).toBe("0.6335");
    expect(roof.totalAreaM2.gt(footprintAreaM2(footprint))).toBe(true); // скат больше проекции
  });
});

describe("раздел 11.5.1: вычет проёмов из площади стены", () => {
  it("проёмы уменьшают площадь стены", () => {
    expect(netWallAreaM2(80, 12.5).toNumber()).toBe(67.5);
  });

  it("проёмы, превышающие площадь стены, — ошибка геометрии, а не отрицательное число", () => {
    expect(() => netWallAreaM2(10, 15)).toThrow();
  });
});

describe("объём утеплителя по площади и толщине", () => {
  it("67.5 м² при 150 мм = 10.125 м³", () => {
    expect(insulationVolumeM3(67.5, 150).toNumber()).toBe(10.125);
  });
});
