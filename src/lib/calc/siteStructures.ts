import { CalcError } from "./money";

/**
 * Skirt (юбка) and porches - §15.
 *
 * Both are places the spec calls out for double counting: a skirt measured on
 * room perimeters instead of the outer contour, and porch landings counted
 * again as treads.
 */

/**
 * Skirt area = outer contour of the chosen base x height. NOT the internal
 * room perimeter (§15). Height 1 m is an example, never a constant.
 */
export function skirtAreaM2(outerPerimeterM: number, heightM: number): number {
  if (outerPerimeterM <= 0 || heightM <= 0) {
    throw new CalcError("Некорректные параметры юбки", "INVALID_SKIRT_INPUT");
  }
  return outerPerimeterM * heightM;
}

export interface StairFlight {
  /** Total height to climb, m. */
  totalHeightM: number;
  /** Clear width of the flight, m. */
  widthM: number;
  /** Desired riser height, m (0.19-0.20 was the stated preference, not a rule). */
  preferredRiserM: number;
  /** Tread depth, m. */
  treadDepthM: number;
}

export interface StairResult {
  /** Risers must be a whole number. */
  riserCount: number;
  /** Actual riser height derived from the total height, not the wish. */
  actualRiserM: number;
  /**
   * A flight of N risers has N-1 treads between them: the top landing (or
   * terrace deck) is the Nth surface and is counted with the landing, not
   * here (§15: "Площадки и проступи не должны учитываться дважды").
   */
  treadCount: number;
  treadAreaM2: number;
}

export function stairFlight(input: StairFlight): StairResult {
  if (input.totalHeightM <= 0 || input.widthM <= 0 || input.preferredRiserM <= 0) {
    throw new CalcError("Некорректные параметры лестницы", "INVALID_STAIR_INPUT");
  }
  const riserCount = Math.max(1, Math.round(input.totalHeightM / input.preferredRiserM));
  const actualRiserM = input.totalHeightM / riserCount;
  const treadCount = riserCount - 1;
  return {
    riserCount,
    actualRiserM,
    treadCount,
    treadAreaM2: treadCount * input.widthM * input.treadDepthM,
  };
}

export interface PorchInput {
  /** Landing (площадка) dimensions, m. */
  landingWidthM: number;
  landingDepthM: number;
  stair: StairFlight;
}

export interface PorchResult {
  landingAreaM2: number;
  stair: StairResult;
  /** Landing + treads, each counted once. */
  totalDeckedAreaM2: number;
}

export function porch(input: PorchInput): PorchResult {
  if (input.landingWidthM <= 0 || input.landingDepthM <= 0) {
    throw new CalcError("Некорректные размеры площадки крыльца", "INVALID_PORCH_INPUT");
  }
  const landingAreaM2 = input.landingWidthM * input.landingDepthM;
  const stair = stairFlight(input.stair);
  return {
    landingAreaM2,
    stair,
    totalDeckedAreaM2: landingAreaM2 + stair.treadAreaM2,
  };
}
