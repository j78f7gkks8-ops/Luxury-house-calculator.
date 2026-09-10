import { describe, expect, it } from "vitest";
import { requiredBulbCount, bulbReserveCount, trackHeadCount } from "./lighting";

describe("lighting", () => {
  it("acceptance #17: 20 track heads + 12 internal spots + 6 terrace spots + 12 facade x2 patrons = 62 GU10; LED chandeliers add none; 10% reserve rounds up to 7", () => {
    const trackHeads = trackHeadCount({ trackCount: 5, headsPerTrack: 4 }); // 5 tracks, 4 heads each = 20
    expect(trackHeads).toBe(20);

    const total = requiredBulbCount([
      { name: "track-heads", count: trackHeads, socketsPerFixture: 1 },
      { name: "internal-spot", count: 12, socketsPerFixture: 1 },
      { name: "terrace-spot", count: 6, socketsPerFixture: 1 },
      { name: "facade", count: 12, socketsPerFixture: 2 },
      { name: "led-chandelier", count: 4, socketsPerFixture: 0, builtinLed: true },
    ]);
    expect(total).toBe(62);
    expect(bulbReserveCount(total, 0.1)).toBe(7);
  });
});
