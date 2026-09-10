import { describe, expect, it } from "vitest";
import { applyOptions, OptionDefinition, OwnedLine } from "./options";
import { CalcError } from "./money";

const baseLines: OwnedLine[] = [
  { key: "floor:kitchen:finish", ownerOptionId: "BASE", line: { material: "OSB dry floor", qty: 24, unit: "m2" } },
  { key: "socket:pump-boiler-1", ownerOptionId: "BASE", line: { material: "socket", qty: 1, unit: "pcs" } },
];

const optionDefs: Record<string, OptionDefinition> = {
  "warm-floor": {
    id: "warm-floor",
    actions: [
      { type: "REPLACE", key: "floor:kitchen:finish", line: { material: "OSB single top layer + screed", qty: 24, unit: "m2" } },
      { type: "ADD", key: "floor:kitchen:contours", line: { material: "PEX contour", qty: 168, unit: "m" } },
      // The pump already has a socket from the boiler-room option; warm-floor's own pump does not duplicate it.
      { type: "ADD", key: "socket:pump-boiler-1", line: { material: "socket", qty: 1, unit: "pcs" } },
    ],
  },
  convectors: {
    id: "convectors",
    actions: [{ type: "ADD", key: "heating:convectors", line: { material: "black convector", qty: 6, unit: "pcs" } }],
  },
  "floating-ceiling-kitchen": {
    id: "floating-ceiling-kitchen",
    actions: [
      { type: "REPLACE", key: "ceiling:kitchen", line: { material: "floating profile", qty: 1, unit: "set" } },
    ],
  },
  "tile-bathroom-wall": {
    id: "tile-bathroom-wall",
    actions: [{ type: "REPLACE", key: "wall:bathroom:1", line: { material: "tile", qty: 5, unit: "m2" } }],
  },
  "ldsp-bathroom-wall": {
    id: "ldsp-bathroom-wall",
    actions: [{ type: "REPLACE", key: "wall:bathroom:1", line: { material: "LDSP", qty: 5, unit: "m2" } }],
  },
  "requires-base-heating": {
    id: "requires-base-heating",
    actions: [{ type: "REQUIRE", requiredOptionId: "convectors" }],
  },
  "excludes-tile": {
    id: "excludes-tile",
    actions: [{ type: "EXCLUDE", excludedOptionId: "tile-bathroom-wall" }],
  },
};

describe("options engine", () => {
  it("§19: warm floor replaces the dry-floor layer and adds contours, without deleting the base construction OSB elsewhere", () => {
    const result = applyOptions(baseLines, ["warm-floor"], optionDefs);
    const floor = result.lines.find((l) => l.key === "floor:kitchen:finish")!;
    expect(floor.line.material).toContain("screed");
    const contours = result.lines.find((l) => l.key === "floor:kitchen:contours");
    expect(contours).toBeDefined();
  });

  it("§19: warm floor's pump does not get a second socket - the boiler room's already serves it", () => {
    const result = applyOptions(baseLines, ["warm-floor"], optionDefs);
    const sockets = result.lines.filter((l) => l.key === "socket:pump-boiler-1");
    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.ownerOptionId).toBe("BASE");
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it("acceptance #15: turning warm floor off (not selected) restores the base floor layer, without needing explicit undo logic", () => {
    const on = applyOptions(baseLines, ["warm-floor"], optionDefs);
    expect(on.lines.find((l) => l.key === "floor:kitchen:finish")!.line.material).toContain("screed");

    const off = applyOptions(baseLines, [], optionDefs);
    expect(off.lines.find((l) => l.key === "floor:kitchen:finish")!.line.material).toBe("OSB dry floor");
  });

  it("reserve convectors persist independently of warm floor selection - not auto-removed", () => {
    const result = applyOptions(baseLines, ["warm-floor", "convectors"], optionDefs);
    expect(result.lines.find((l) => l.key === "heating:convectors")).toBeDefined();
  });

  it("selecting an option twice is idempotent - no duplicated lines", () => {
    const once = applyOptions(baseLines, ["warm-floor"], optionDefs);
    const twice = applyOptions(baseLines, ["warm-floor", "warm-floor"], optionDefs);
    expect(twice.lines).toEqual(once.lines);
  });

  it("tile replaces LDSP on the same wall surface", () => {
    const result = applyOptions(baseLines, ["ldsp-bathroom-wall", "tile-bathroom-wall"], optionDefs);
    const wall = result.lines.find((l) => l.key === "wall:bathroom:1")!;
    expect(wall.line.material).toBe("tile");
  });

  it("REQUIRE / EXCLUDE dependencies are validated, not silently ignored", () => {
    expect(() => applyOptions(baseLines, ["requires-base-heating"], optionDefs)).toThrow(CalcError);
    expect(() =>
      applyOptions(baseLines, ["excludes-tile", "tile-bathroom-wall"], optionDefs),
    ).toThrow(CalcError);
    expect(() =>
      applyOptions(baseLines, ["requires-base-heating", "convectors"], optionDefs),
    ).not.toThrow();
  });
});

describe("acceptance #16: a component already inside a package is not charged again", () => {
  // §Б3: the preliminary terrace-roof frame estimate is 40 six-metre "150"
  // boards + 6 "200", and it ALREADY covers the nine composite posts
  // (9 x 3 = 27 boards) and the offcuts they leave.
  const roofKitDefs: Record<string, OptionDefinition> = {
    "terrace-roof-kit": {
      id: "terrace-roof-kit",
      actions: [
        {
          type: "ADD",
          key: "shell:terrace:roof-frame",
          line: { material: "Доска 150, 6 м (несущий каркас крыши террасы)", qty: 40, unit: "шт" },
        },
        {
          type: "ADD",
          key: "shell:terrace:roof-frame-200",
          line: { material: "Доска 200, 6 м", qty: 6, unit: "шт" },
        },
        // the posts are part of this kit, occupying their own physical node
        {
          type: "ADD",
          key: "shell:terrace:posts",
          line: { material: "Столбы (9 составных, входят в комплект крыши)", qty: 9, unit: "шт" },
        },
      ],
    },
    // a separate option that would add the same posts as loose boards
    "terrace-posts-separate": {
      id: "terrace-posts-separate",
      actions: [
        {
          type: "ADD",
          key: "shell:terrace:posts",
          line: { material: "Доски столбов 3 шт x 9 столбов", qty: 27, unit: "шт" },
        },
      ],
    },
  };

  it("selecting both the roof kit and separate posts does not double the posts", () => {
    const result = applyOptions([], ["terrace-roof-kit", "terrace-posts-separate"], roofKitDefs);
    const postLines = result.lines.filter((l) => l.key === "shell:terrace:posts");

    expect(postLines).toHaveLength(1);
    expect(postLines[0]!.line.qty).toBe(9); // the kit's posts, not 27 loose boards on top
    expect(postLines[0]!.ownerOptionId).toBe("terrace-roof-kit");
    expect(result.conflicts.some((c) => c.includes("shell:terrace:posts"))).toBe(true);
  });

  it("the roof kit total is not inflated by re-adding post boards", () => {
    const kitOnly = applyOptions([], ["terrace-roof-kit"], roofKitDefs);
    const kitPlusPosts = applyOptions([], ["terrace-roof-kit", "terrace-posts-separate"], roofKitDefs);

    const boards = (r: typeof kitOnly) =>
      r.lines.reduce((sum, l) => sum + (l.line.unit === "шт" ? l.line.qty : 0), 0);
    expect(boards(kitPlusPosts)).toBe(boards(kitOnly));
  });
});
