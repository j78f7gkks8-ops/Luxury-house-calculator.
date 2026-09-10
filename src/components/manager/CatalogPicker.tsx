"use client";

import Image from "next/image";

export interface CatalogListItem {
  projectId: string;
  displayName: string;
  nameAliases: string[];
  category: string;
  series: string | null;
  sourceUrl: string;
  planImagePath: string | null;
  planReviewStatus: string;
  blockedForCalculation: boolean;
  advertisedAreaM2: number | null;
  areaDefinition: string | null;
  labeledIndoorAreaSumM2: number | null;
  terraceLabeledAreaM2: number | null;
  enclosedBodyGrossAreaM2: number | null;
  ceilingHeightM: number | null;
  roofText: string | null;
  bedroomsCount: number | null;
  bathroomsCount: number | null;
  issues: { code: string; message: string }[];
  approvedTemplateId: string | null;
  hasDrawing?: boolean;
}

function area(value: number | null): string {
  return value === null ? "не указано" : `${value} м²`;
}

export function CatalogPicker({
  projects,
  selectedId,
  onSelect,
}: {
  projects: CatalogListItem[];
  selectedId: string | null;
  onSelect: (projectId: string) => void;
}) {
  const houses = projects.filter((p) => p.category === "house");
  const saunas = projects.filter((p) => p.category === "sauna");

  return (
    <div>
      <Group title={`Дома (${houses.length})`} projects={houses} selectedId={selectedId} onSelect={onSelect} />
      <Group title={`Бани (${saunas.length})`} projects={saunas} selectedId={selectedId} onSelect={onSelect} />
    </div>
  );
}

function Group({
  title,
  projects,
  selectedId,
  onSelect,
}: {
  title: string;
  projects: CatalogListItem[];
  selectedId: string | null;
  onSelect: (projectId: string) => void;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="section-title">{title}</div>
      <div className="catalog-grid">
        {projects.map((p) => {
          const selected = p.projectId === selectedId;
          return (
            <button
              key={p.projectId}
              type="button"
              className={`catalog-card${selected ? " selected" : ""}${p.blockedForCalculation ? " blocked" : ""}`}
              onClick={() => !p.blockedForCalculation && onSelect(p.projectId)}
              disabled={p.blockedForCalculation}
              title={p.blockedForCalculation ? p.issues[0]?.message : undefined}
            >
              {p.planImagePath && (
                <span className="catalog-plan">
                  <Image src={p.planImagePath} alt={`Планировка ${p.displayName}`} fill sizes="220px" style={{ objectFit: "contain" }} />
                </span>
              )}
              <span className="catalog-name">{p.displayName}</span>
              {p.nameAliases.length > 0 && <span className="catalog-alias">также: {p.nameAliases.join(", ")}</span>}
              <span className="catalog-areas">
                <span>Площадь сайта: {area(p.advertisedAreaM2)}</span>
                <span>Внутри по плану: {area(p.labeledIndoorAreaSumM2)}</span>
                <span>Терраса: {area(p.terraceLabeledAreaM2)}</span>
              </span>
              <span className="catalog-badges">
                {p.roofText && <span className="tag">{p.roofText}</span>}
                {p.hasDrawing && <span className="tag ok">есть рабочий чертёж</span>}
                {p.approvedTemplateId && <span className="tag ok">есть утверждённая редакция</span>}
                {p.blockedForCalculation && <span className="tag danger">план противоречит карточке</span>}
                {!p.blockedForCalculation && p.issues.length > 0 && <span className="tag warn">расхождение источника</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
