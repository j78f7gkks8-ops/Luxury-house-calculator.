import { describe, expect, it } from "vitest";
import {
  wellLengths,
  septicLengths,
  mergedTrenchLengthM,
  naiveTrenchLengthM,
} from "./externalUtilities";
import { CalcError } from "./money";

describe("external utilities", () => {
  it("§15 worked example: a well 4m from the house insulates 2+4+2=8m, whatever the drilled depth", () => {
    const shallow = wellLengths({
      drillDepthM: 16,
      pumpSuspensionDepthM: 14,
      distanceToHouseM: 4,
      riseToDistributorM: 2,
      insulatedDepthIntoWellM: 2,
    });
    const deep = wellLengths({
      drillDepthM: 30,
      pumpSuspensionDepthM: 28,
      distanceToHouseM: 4,
      riseToDistributorM: 2,
      insulatedDepthIntoWellM: 2,
    });

    expect(shallow.insulatedLengthM).toBe(8);
    // the deeper borehole must NOT stretch the insulated section
    expect(deep.insulatedLengthM).toBe(8);
    expect(deep.insulatedLengthM).not.toBe(deep.drillDepthM);
  });

  it("drilling depth, pipe length and insulated length stay three different numbers", () => {
    const w = wellLengths({
      drillDepthM: 30,
      pumpSuspensionDepthM: 28,
      distanceToHouseM: 4,
      riseToDistributorM: 2,
      insulatedDepthIntoWellM: 2,
    });
    expect(w.drillDepthM).toBe(30);
    expect(w.pipeLengthM).toBe(34); // 28 + 4 + 2
    expect(w.insulatedLengthM).toBe(8);
    expect(new Set([w.drillDepthM, w.pipeLengthM, w.insulatedLengthM]).size).toBe(3);
  });

  it("rejects a pump hanging deeper than the borehole", () => {
    expect(() =>
      wellLengths({
        drillDepthM: 16,
        pumpSuspensionDepthM: 20,
        distanceToHouseM: 4,
        riseToDistributorM: 2,
        insulatedDepthIntoWellM: 2,
      }),
    ).toThrow(CalcError);
  });

  it("§15: septic distance is an object parameter, not a constant", () => {
    expect(septicLengths({ distanceFromHouseM: 10, ringCount: 2 }).sewerRunM).toBe(10);
    expect(septicLengths({ distanceFromHouseM: 6, ringCount: 2 }).sewerRunM).toBe(6);
  });

  it("§15: a trench shared by two routes is dug once, not twice", () => {
    // water from the well (0..4 m) and sewer to the septic (0..10 m) share the first 4 m
    const runs = [
      { name: "вода от скважины", fromM: 0, toM: 4 },
      { name: "канализация к септику", fromM: 0, toM: 10 },
    ];
    expect(naiveTrenchLengthM(runs)).toBe(14); // naive sum double-counts the shared run
    expect(mergedTrenchLengthM(runs)).toBe(10); // merged: dug once
  });

  it("keeps genuinely separate trench runs separate", () => {
    const runs = [
      { name: "вода", fromM: 0, toM: 4 },
      { name: "электроввод в другую сторону", fromM: 12, toM: 20 },
    ];
    expect(mergedTrenchLengthM(runs)).toBe(12); // 4 + 8, no overlap to merge
  });
});
