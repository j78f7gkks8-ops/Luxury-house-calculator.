import { CalcError } from "./money";

/** §12: lighting is its own block, tracked separately from ceilings/electrics. */
export interface LightFixtureGroup {
  name: string;
  count: number;
  /** sockets/patrons per fixture that need a bulb (0 for a fixture with built-in LED and no replaceable bulb). */
  socketsPerFixture: number;
  builtinLed?: boolean;
}

/** GU10 (or other socketed bulb) count: fixtures with built-in LED contribute 0 - test #17. */
export function requiredBulbCount(groups: LightFixtureGroup[]): number {
  return groups.reduce((sum, g) => {
    if (g.count < 0 || g.socketsPerFixture < 0) {
      throw new CalcError("Отрицательное количество приборов/патронов", "NEGATIVE_QTY");
    }
    if (g.builtinLed) return sum;
    return sum + g.count * g.socketsPerFixture;
  }, 0);
}

export function bulbReserveCount(requiredCount: number, reserveFraction = 0.1): number {
  return Math.ceil(requiredCount * reserveFraction);
}

/** A track (трек) is a rail, not a head - track head count must be tracked as its own fixture group. */
export interface TrackConfig {
  trackCount: number;
  headsPerTrack: number;
}

export function trackHeadCount(track: TrackConfig): number {
  if (track.trackCount < 0 || track.headsPerTrack < 0) {
    throw new CalcError("Отрицательное количество треков/головок", "NEGATIVE_QTY");
  }
  return track.trackCount * track.headsPerTrack;
}
