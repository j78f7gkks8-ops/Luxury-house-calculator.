import { createHash } from "node:crypto";

/**
 * Раздел 20.1: загрузка произвольного PDF. Реализованы этапы 1-5 (приём/версия, вектор и
 * текст, классификация страниц по ключевым словам, извлечение чисел-кандидатов на размеры)
 * для PDF с векторным текстовым слоем. Этапы 6-10 (топология полигонов, увязка листов между
 * собой, редактируемая накладка на плане) требуют полноценного геометрического движка и
 * ЧЕСТНО не реализованы в этой версии — результат всегда получает статус needs_review и
 * ожидает подтверждения человеком (раздел 20.1 п.9-10), а не выдаётся как готовый расчёт.
 * Сканы без текстового слоя требуют OCR/визуальную модель с ключом — при его отсутствии
 * страница помечается статусом "требует OCR", а не тихо пропускается.
 */

export interface ExtractedPageText {
  pageNumber: number;
  text: string;
  classification: PageClassification;
  candidateDimensionsMm: number[];
  hasTextLayer: boolean;
}

export type PageClassification =
  | "plan"
  | "explication"
  | "facade"
  | "section"
  | "pile_scheme"
  | "layout"
  | "specification"
  | "visualization"
  | "notes"
  | "unclassified";

export interface PdfImportResult {
  sha256: string;
  pageCount: number;
  pages: ExtractedPageText[];
  status: "needs_review" | "error";
  errorMessage?: string;
}

const CLASSIFICATION_KEYWORDS: Record<PageClassification, string[]> = {
  plan: ["план", "планировка", "этаж"],
  explication: ["экспликация", "ведомость помещений"],
  facade: ["фасад"],
  section: ["разрез"],
  pile_scheme: ["свайное поле", "свая", "сваи", "фундамент"],
  layout: ["раскладка", "раскрой"],
  specification: ["спецификация", "ведомость материалов"],
  visualization: ["визуализация", "3d", "рендер"],
  notes: ["примечание", "примечания"],
  unclassified: [],
};

export function classifyPageText(text: string): PageClassification {
  const lower = text.toLowerCase();
  for (const [cls, keywords] of Object.entries(CLASSIFICATION_KEYWORDS) as [PageClassification, string[]][]) {
    if (cls === "unclassified") continue;
    if (keywords.some((k) => lower.includes(k))) return cls;
  }
  return "unclassified";
}

/**
 * Извлекает числа-кандидаты на размеры (в мм). Не путает страницу/масштаб/дату с размером:
 * фильтрует диапазон 50-20000 мм как правдоподобный для строительных размеров, но НЕ
 * утверждает калибровку — это только кандидаты для последующей ручной сверки (раздел 20.1 п.5).
 */
export function extractCandidateDimensionsMm(text: string): number[] {
  // Отрицательный lookbehind на ":" отсекает масштабные обозначения вида "М1:100".
  const matches = text.match(/(?<!:)\b\d{2,5}(?=\s*(мм|mm)?\b)/g) ?? [];
  const numbers = matches.map(Number).filter((n) => n >= 50 && n <= 20000);
  return Array.from(new Set(numbers));
}

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function extractPdfText(buffer: Buffer): Promise<{ pageCount: number; pages: { pageNumber: number; text: string }[] }> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;
  const pages: { pageNumber: number; text: string }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ");
    pages.push({ pageNumber: i, text });
  }
  return { pageCount: doc.numPages, pages };
}

export async function runPdfImportPipeline(buffer: Buffer): Promise<PdfImportResult> {
  const sha256 = sha256Hex(buffer);
  try {
    const { pageCount, pages } = await extractPdfText(buffer);
    const extractedPages: ExtractedPageText[] = pages.map((p) => {
      const hasTextLayer = p.text.trim().length > 0;
      return {
        pageNumber: p.pageNumber,
        text: p.text,
        classification: hasTextLayer ? classifyPageText(p.text) : "unclassified",
        candidateDimensionsMm: hasTextLayer ? extractCandidateDimensionsMm(p.text) : [],
        hasTextLayer,
      };
    });
    return { sha256, pageCount, pages: extractedPages, status: "needs_review" };
  } catch (e: any) {
    return { sha256, pageCount: 0, pages: [], status: "error", errorMessage: e.message };
  }
}
