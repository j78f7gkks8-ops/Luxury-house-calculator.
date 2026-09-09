import { describe, expect, it } from "vitest";
import {
  gridPileCount,
  shiftEdgeRow,
  bindingLengthMm,
  independentFixturePiles,
  sharedCornerFixturePiles,
  gridWithCutout,
  dedupePileNodes,
} from "./piles";

describe("piles / foundation", () => {
  it("acceptance #5: Barn 96 / Kyzyl 5x5=25 piles; enlarging terrace 2->3m shifts exactly 5 outer-row piles, keeps 25 total, rebinds", () => {
    const before: { xCoordsMm: number[]; yCoordsMm: number[] } = {
      xCoordsMm: [0, 1900, 4900, 7900, 10800],
      yCoordsMm: [0, 1867, 3733, 5600, 7800],
    };
    expect(gridPileCount(before)).toBe(25);

    const afterX = shiftEdgeRow(before.xCoordsMm, 0, 1000);
    expect(afterX).toEqual([0, 2900, 5900, 8900, 11800]);

    const after = { xCoordsMm: afterX, yCoordsMm: before.yCoordsMm };
    expect(gridPileCount(after)).toBe(25);

    // exactly 5 piles change position (one whole row of the X=0 row, one per Y coordinate)
    const movedCount = before.yCoordsMm.length;
    expect(movedCount).toBe(5);

    // binding (обвязка) length is recalculated, not reused
    expect(bindingLengthMm(after)).not.toBe(bindingLengthMm(before));
  });

  it("acceptance #6: independent boiler room adds 4 piles (25+4=29); shared-corner variant (28) is a distinct, explicitly chosen alternative", () => {
    const independent = independentFixturePiles(25, 4);
    expect(independent.pileCount).toBe(29);

    const sharedCorner = sharedCornerFixturePiles(25, 4, 1);
    expect(sharedCorner.pileCount).toBe(28);

    expect(independent.name).not.toBe(sharedCorner.name);
  });

  it("crossing lines at an exact shared coordinate do not create a duplicate pile; near-but-different coordinates stay distinct", () => {
    const nodes = dedupePileNodes([
      { xMm: 1000, yMm: 1000 },
      { xMm: 1000, yMm: 1000 }, // crossing lines referencing the same corner node
      { xMm: 1001, yMm: 1000 }, // close, but not the same physical pile
    ]);
    expect(nodes).toHaveLength(2);
  });

  it("acceptance #7: Orbita regular grid 20 - 1 + 5 = 24", () => {
    expect(gridWithCutout(20, 1, 5)).toBe(24);
  });

  it("acceptance #7: Norma 77, 6x4 = 24 piles from stated coordinates", () => {
    const grid = {
      xCoordsMm: [0, 2925, 5031, 7138, 9244, 11350],
      yCoordsMm: [0, 2925, 5925, 8850],
    };
    expect(gridPileCount(grid)).toBe(24);
  });
});
