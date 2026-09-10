import { describe, it, expect } from "vitest";
import {
  gridPileCount,
  BARN96_KYZYL_ACROSS_BEFORE_MM,
  BARN96_KYZYL_ACROSS_AFTER_MM,
  BARN96_KYZYL_ALONG_MM,
  reanchorToBuildingFrame,
  kotelnayaJointVariants,
  applyGridExceptions,
  ORBITA_BASE_GRID,
  ORBITA_REMOVED,
  ORBITA_ADDED,
  NORMA77_XS_MM,
  NORMA77_YS_MM,
  pileFoundationMaterialsCost,
  SCREW_PILE_D89_L3000_AFTER_DISCOUNT,
  PILE_HEAD_AFTER_DISCOUNT,
} from "../src/foundation.js";

describe("раздел 8/23.5: Барн 96 / Кызыл — терраса 2→3 м", () => {
  it("25 опор до и после увеличения террасы", () => {
    expect(gridPileCount({ xsMm: BARN96_KYZYL_ACROSS_BEFORE_MM, ysMm: BARN96_KYZYL_ALONG_MM })).toBe(25);
    expect(gridPileCount({ xsMm: BARN96_KYZYL_ACROSS_AFTER_MM, ysMm: BARN96_KYZYL_ALONG_MM })).toBe(25);
  });

  it("после привязки к общей раме дома 4 из 5 координат не изменились — сдвинулся только внешний ряд", () => {
    const reanchored = reanchorToBuildingFrame(BARN96_KYZYL_ACROSS_AFTER_MM, 1000);
    expect(reanchored.slice(1)).toEqual(BARN96_KYZYL_ACROSS_BEFORE_MM.slice(1));
    expect(reanchored[0]).toBe(BARN96_KYZYL_ACROSS_BEFORE_MM[0] - 1000);
  });
});

describe("раздел 8: независимая кочегарка — варианты не смешиваются", () => {
  it("25+4=29 независимых; альтернативный общий узел — 28 хранится отдельно", () => {
    const variants = kotelnayaJointVariants(25);
    expect(variants.find((v) => v.name === "independent_4_piles")!.uniquePileCount).toBe(29);
    expect(variants.find((v) => v.name === "shared_corner_node")!.uniquePileCount).toBe(28);
  });
});

describe("раздел 8/23.7: Орбита и Норма 77", () => {
  it("Орбита: 20-1+5=24", () => {
    expect(applyGridExceptions(ORBITA_BASE_GRID, ORBITA_REMOVED, ORBITA_ADDED)).toBe(24);
  });

  it("Норма 77: 6×4=24", () => {
    expect(gridPileCount({ xsMm: NORMA77_XS_MM, ysMm: NORMA77_YS_MM })).toBe(24);
  });
});

describe("раздел 23.1: 27 винтовых свай + 27 оголовков по чеку", () => {
  it("27 × (3608.40 + 511.50) = 111237.30 ₽", () => {
    const cost = pileFoundationMaterialsCost(27, SCREW_PILE_D89_L3000_AFTER_DISCOUNT, PILE_HEAD_AFTER_DISCOUNT);
    expect(cost.toFixed(2)).toBe("111237.30");
  });
});
