import type { CatalogProject } from "../types";

/**
 * Раздел 7.4: "не объединяй все контуры по одному признаку «площадь дома»". Это НЕ чертёж —
 * настоящих PDF планировок 13 стартовых домов в этой системе нет (архив с исходниками не был
 * приложен к заданию). Схема строит примерное расположение комнат по их площади простым
 * treemap-алгоритмом (slice-and-dice), чтобы дать понятную картинку вместо голого списка
 * цифр — реальные пропорции и расположение дверей/окон она не показывает.
 */

interface RoomRect {
  name: string;
  areaM2: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

function layoutRooms(rooms: { name: string; areaM2: number }[], x: number, y: number, w: number, h: number, horizontal: boolean): RoomRect[] {
  if (rooms.length === 0) return [];
  if (rooms.length === 1) return [{ ...rooms[0], x, y, w, h }];

  const total = rooms.reduce((a, r) => a + r.areaM2, 0);
  let running = 0;
  let splitIndex = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < rooms.length; i++) {
    running = rooms.slice(0, i).reduce((a, r) => a + r.areaM2, 0);
    const diff = Math.abs(running - total / 2);
    if (diff < bestDiff) {
      bestDiff = diff;
      splitIndex = i;
    }
  }
  const groupA = rooms.slice(0, splitIndex);
  const groupB = rooms.slice(splitIndex);
  const areaA = groupA.reduce((a, r) => a + r.areaM2, 0);

  if (horizontal) {
    const wA = (w * areaA) / total;
    return [...layoutRooms(groupA, x, y, wA, h, false), ...layoutRooms(groupB, x + wA, y, w - wA, h, false)];
  }
  const hA = (h * areaA) / total;
  return [...layoutRooms(groupA, x, y, w, hA, true), ...layoutRooms(groupB, x, y + hA, w, h - hA, true)];
}

const ROOM_COLORS = ["#e8f0ea", "#eef2ee", "#e3ede6", "#f0f4f0", "#e6efe9", "#ecf1ec"];

export function FloorPlanSchematic({ project }: { project: CatalogProject }) {
  const spanM = project.rectFootprint?.spanM ?? Math.sqrt(project.closedFootprintM2);
  const lengthM = project.rectFootprint?.lengthM ?? Math.sqrt(project.closedFootprintM2);
  const isApproximateShape = !project.rectFootprint;

  const pad = 0.4;
  const rects = layoutRooms(project.rooms, pad, pad, lengthM - pad * 2, spanM - pad * 2, lengthM >= spanM);

  const vbW = lengthM;
  const vbH = spanM;
  const fontSize = Math.min(vbW, vbH) * 0.045;

  return (
    <div>
      <svg viewBox={`0 0 ${vbW} ${vbH}`} style={{ width: "100%", maxWidth: 480, background: "#fff", border: "1px solid #e3e2de", borderRadius: 8 }}>
        <rect x={0} y={0} width={vbW} height={vbH} fill="none" stroke="#2f6f4f" strokeWidth={vbW * 0.012} />
        {rects.map((r, i) => (
          <g key={r.name + i}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={ROOM_COLORS[i % ROOM_COLORS.length]} stroke="#b7c4bb" strokeWidth={vbW * 0.003} />
            <text x={r.x + r.w / 2} y={r.y + r.h / 2 - fontSize * 0.4} textAnchor="middle" fontSize={fontSize} fill="#23241f">
              {r.name}
            </text>
            <text x={r.x + r.w / 2} y={r.y + r.h / 2 + fontSize * 0.9} textAnchor="middle" fontSize={fontSize * 0.85} fill="#6b6a63">
              {r.areaM2.toFixed(1)} м²
            </text>
          </g>
        ))}
      </svg>
      <p className="muted" style={{ maxWidth: 480 }}>
        Схема расположения комнат по площади (не настоящий чертёж — исходный PDF этой планировки не загружен).
        {isApproximateShape && " Контур Г-образный/составной — здесь упрощён до прямоугольника, реальную форму см. в описании."}
      </p>
    </div>
  );
}
