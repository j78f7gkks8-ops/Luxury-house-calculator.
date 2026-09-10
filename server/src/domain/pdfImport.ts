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

const SPACE_CHARS = "    ";
const GROUPED_THOUSANDS_RE = new RegExp(`(?<!:)\\b\\d{1,3}(?:[${SPACE_CHARS}]\\d{3})+\\b`, "g");
const PLAIN_DIMENSION_RE = /(?<!:)\b\d{2,5}\b/g;

/**
 * Извлекает числа-кандидаты на размеры (в мм) из ОДНОГО текстового фрагмента PDF (одного
 * pdfjs TextItem, либо — для синтетических/тестовых PDF без пословной разбивки — целой
 * строки). Работать нужно именно в пределах одного фрагмента, а не по всему склеенному
 * пробелами тексту страницы: в реальных чертежах CAD-экспорта размер с разделителем тысяч
 * ("9 000", "11 000") отдаётся pdfjs ОДНИМ фрагментом с пробелом внутри, а два разных
 * соседних размера ("220" и "920") — двумя независимыми фрагментами. Если склеить всё в одну
 * строку и мержить через regex вслепую, "220 920" неотличимо от настоящего "3 450 600" —
 * можно случайно объединить два разных реальных размера в один мусорный.
 */
function extractFromFragment(fragment: string): number[] {
  // Площади в ведомости помещений записаны через запятую как разделитель дробной части
  // ("4,72", "79,08 м²") — маскируем их целиком, иначе их целая/дробная часть проходит
  // фильтр диапазона и превращается в мусорные "кандидаты на размер" вроде 72 или 79.
  const masked = fragment.replace(/\d+[.,]\d+/g, (m) => " ".repeat(m.length));

  const numbers: number[] = [];
  for (const g of masked.match(GROUPED_THOUSANDS_RE) ?? []) {
    const n = Number(g.replace(new RegExp(`[${SPACE_CHARS}]`, "g"), ""));
    if (n >= 50 && n <= 20000) numbers.push(n);
  }
  // Вырезаем уже распознанные группы тысяч, чтобы их отдельные тройки цифр не задвоились
  // как самостоятельные "размеры" на следующем шаге.
  const withoutGrouped = masked.replace(GROUPED_THOUSANDS_RE, (m) => " ".repeat(m.length));
  for (const p of withoutGrouped.match(PLAIN_DIMENSION_RE) ?? []) {
    const n = Number(p);
    if (n >= 50 && n <= 20000) numbers.push(n);
  }
  return numbers;
}

/**
 * Не путает страницу/масштаб/дату с размером: фильтрует диапазон 50-20000 мм как
 * правдоподобный для строительных размеров, но НЕ утверждает калибровку — это только
 * кандидаты для последующей ручной сверки (раздел 20.1 п.5).
 *
 * Принимает либо массив текстовых фрагментов страницы (предпочтительно — см. extractPdfText),
 * либо (для обратной совместимости и простых случаев) одну строку целиком.
 */
export function extractCandidateDimensionsMm(fragments: string | string[]): number[] {
  const list = Array.isArray(fragments) ? fragments : [fragments];
  const all = list.flatMap(extractFromFragment);
  return Array.from(new Set(all));
}

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function extractPdfText(
  buffer: Buffer
): Promise<{ pageCount: number; pages: { pageNumber: number; text: string; items: string[] }[] }> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;
  const pages: { pageNumber: number; text: string; items: string[] }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // items сохраняем как отдельные фрагменты (не склеенные в одну строку) — это единственный
    // способ надёжно отличить размер с разделителем тысяч внутри одного фрагмента ("9 000")
    // от двух разных соседних размеров, случайно оказавшихся рядом через пробел-разделитель
    // join(). См. extractFromFragment выше.
    const items = content.items.map((item: any) => ("str" in item ? item.str : "")).filter((s: string) => s.trim().length > 0);
    const text = items.join(" ");
    pages.push({ pageNumber: i, text, items });
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
        candidateDimensionsMm: hasTextLayer ? extractCandidateDimensionsMm(p.items) : [],
        hasTextLayer,
      };
    });
    return { sha256, pageCount, pages: extractedPages, status: "needs_review" };
  } catch (e: any) {
    return { sha256, pageCount: 0, pages: [], status: "error", errorMessage: e.message };
  }
}
