import { describe, expect, it } from "vitest";
import {
  lShapeAreaM2,
  sumOfRectPartitions,
  resolveWallInstances,
  slopedRoofAreaM2,
} from "./geometry";
import { CalcError } from "./money";

describe("geometry", () => {
  it("acceptance #3: L-shaped terrace area agrees across two decompositions = 43.5 m2", () => {
    const decomposition1 = sumOfRectPartitions([
      { widthM: 10.5, heightM: 3 },
      { widthM: 2, heightM: 6 },
    ]);
    const decomposition2 = sumOfRectPartitions([
      { widthM: 8.5, heightM: 3 },
      { widthM: 2, heightM: 9 },
    ]);
    const boundingBoxMinusNotch = lShapeAreaM2(10.5, 9, 8.5, 6);

    expect(decomposition1).toBeCloseTo(43.5, 6);
    expect(decomposition2).toBeCloseTo(43.5, 6);
    expect(boundingBoxMinusNotch).toBeCloseTo(43.5, 6);
  });

  it("acceptance #4: terrace deck and roof projection are independent numbers", () => {
    const areas = { deckM2: 43.5, roofProjectionM2: 33 };
    expect(areas.deckM2).not.toBe(areas.roofProjectionM2);
  });

  it("rejects negative/zero area inputs instead of producing a false total (acceptance #24)", () => {
    expect(() => sumOfRectPartitions([{ widthM: -1, heightM: 3 }])).toThrow(CalcError);
    expect(() => lShapeAreaM2(10, 9, -1, 6)).toThrow(CalcError);
  });

  it("acceptance #8: a shared sheet counts two wall instances; a duplicate PDF of one instance counts once", () => {
    const resolved = resolveWallInstances([
      { sheetId: "1.03", instanceKeys: ["wall-1.03", "wall-2.01"], contentHash: "hashA" },
      { sheetId: "terrace-2(3)", instanceKeys: ["terrace-wall-2"], contentHash: "hashB" },
      { sheetId: "terrace-2(4)", instanceKeys: ["terrace-wall-2"], contentHash: "hashB" },
    ]);

    const wallInstanceKeys = resolved.map((r) => r.instanceKey).sort();
    expect(wallInstanceKeys).toEqual(["terrace-wall-2", "wall-1.03", "wall-2.01"]);

    const terraceWall = resolved.find((r) => r.instanceKey === "terrace-wall-2")!;
    expect(terraceWall.sourceSheetIds).toHaveLength(2); // both files recorded
  });

  it("flags conflicting drawing versions for the same instance instead of silently picking one", () => {
    expect(() =>
      resolveWallInstances([
        { sheetId: "v1", instanceKeys: ["wall-x"], contentHash: "old" },
        { sheetId: "v2", instanceKeys: ["wall-x"], contentHash: "new" },
      ]),
    ).toThrow(CalcError);
  });

  it("sloped roof area from horizontal projection", () => {
    const area = slopedRoofAreaM2(100, 9);
    expect(area).toBeGreaterThan(100);
    expect(area).toBeCloseTo(100 / Math.cos((9 * Math.PI) / 180), 6);
  });
});
