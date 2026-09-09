/**
 * Geometric quantities are stored in millimetres (integers) everywhere in the
 * domain model. m / m2 / m3 are derived through explicit conversion at the
 * point of use - see §7 of the master prompt: "Название модели «77» не
 * означает 77 м² любого слоя."
 */

export function mmToM(mm: number): number {
  return mm / 1000;
}

export function mToMm(m: number): number {
  return Math.round(m * 1000);
}

export function mm2ToM2(mm2: number): number {
  return mm2 / 1_000_000;
}

export function mm3ToM3(mm3: number): number {
  return mm3 / 1_000_000_000;
}

/** Area of a rectangle given in millimetres, returned in m². */
export function rectAreaM2(widthMm: number, heightMm: number): number {
  return mm2ToM2(widthMm * heightMm);
}

/** Sloped roof surface from its horizontal projection and pitch angle. */
export function slopedAreaFromProjection(projectionM2: number, pitchDeg: number): number {
  const rad = (pitchDeg * Math.PI) / 180;
  return projectionM2 / Math.cos(rad);
}
