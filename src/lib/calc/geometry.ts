import { CalcError } from "./money";

/** Shoelace formula. Vertices in metres, in order (CW or CCW), returns m². */
export function polygonAreaM2(verticesM: [number, number][]): number {
  if (verticesM.length < 3) {
    throw new CalcError("Полигон должен иметь минимум 3 вершины", "INVALID_POLYGON");
  }
  let area = 0;
  for (let i = 0; i < verticesM.length; i++) {
    const [x1, y1] = verticesM[i]!;
    const [x2, y2] = verticesM[(i + 1) % verticesM.length]!;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

/**
 * L-shaped outline expressed as an outer bounding box with one corner notch
 * removed. This is the common case for L-shaped terraces (§7, §23 test #3):
 * different decompositions of the same outline must agree on total area.
 */
export function lShapeAreaM2(outerWidthM: number, outerHeightM: number, notchWidthM: number, notchHeightM: number): number {
  if (outerWidthM <= 0 || outerHeightM <= 0) {
    throw new CalcError("Отрицательная или нулевая площадь недопустима", "NEGATIVE_AREA");
  }
  if (notchWidthM < 0 || notchHeightM < 0 || notchWidthM > outerWidthM || notchHeightM > outerHeightM) {
    throw new CalcError("Некорректный вырез контура", "INVALID_NOTCH");
  }
  return outerWidthM * outerHeightM - notchWidthM * notchHeightM;
}

/** Sum of non-overlapping rectangle partitions - a decomposition sanity check. */
export function sumOfRectPartitions(rects: { widthM: number; heightM: number }[]): number {
  for (const r of rects) {
    if (r.widthM <= 0 || r.heightM <= 0) {
      throw new CalcError("Отрицательная или нулевая площадь недопустима", "NEGATIVE_AREA");
    }
  }
  return rects.reduce((s, r) => s + r.widthM * r.heightM, 0);
}

/**
 * A house/terrace tracks multiple independent area layers - deck, roof
 * projection, heated floor, ceiling, cladding, skirt - none of which may be
 * derived from another's number by convention (§7, test #4).
 */
export interface TerraceAreas {
  deckM2: number;
  roofProjectionM2: number;
  roofSlopedM2?: number;
}

export function slopedRoofAreaM2(projectionM2: number, pitchDeg: number): number {
  if (pitchDeg < 0 || pitchDeg >= 90) {
    throw new CalcError("Некорректный угол ската", "INVALID_PITCH");
  }
  return projectionM2 / Math.cos((pitchDeg * Math.PI) / 180);
}

/**
 * Wall-sheet -> physical-instance resolution for imported drawings (§20, §23
 * test #8): one sheet can legitimately describe two distinct wall instances
 * (both counted), while duplicate files of the same sheet for the same
 * instance must collapse to one, regardless of filename.
 */
export interface WallSheetImport {
  sheetId: string;
  /** Physical wall instance keys this single sheet's drawing applies to. */
  instanceKeys: string[];
  /** Content hash of the drawing (same drawing re-exported/re-uploaded shares this). */
  contentHash: string;
}

export interface ResolvedWallInstance {
  instanceKey: string;
  sourceSheetIds: string[];
  contentHash: string;
}

export function resolveWallInstances(sheets: WallSheetImport[]): ResolvedWallInstance[] {
  const byInstance = new Map<string, ResolvedWallInstance>();
  for (const sheet of sheets) {
    for (const instanceKey of sheet.instanceKeys) {
      const existing = byInstance.get(instanceKey);
      if (existing) {
        if (existing.contentHash === sheet.contentHash) {
          // Same drawing content re-imported for the same instance: dedupe, don't double the wall.
          if (!existing.sourceSheetIds.includes(sheet.sheetId)) {
            existing.sourceSheetIds.push(sheet.sheetId);
          }
          continue;
        }
        throw new CalcError(
          `Конфликт версий: инстанс "${instanceKey}" описан разными чертежами`,
          "VERSION_CONFLICT",
          { instanceKey, sheets: [existing.sourceSheetIds, sheet.sheetId] },
        );
      }
      byInstance.set(instanceKey, {
        instanceKey,
        sourceSheetIds: [sheet.sheetId],
        contentHash: sheet.contentHash,
      });
    }
  }
  return Array.from(byInstance.values());
}
