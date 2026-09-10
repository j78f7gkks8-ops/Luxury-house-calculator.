import { describe, it, expect } from "vitest";
import PDFDocument from "pdfkit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runPdfImportPipeline, classifyPageText, extractCandidateDimensionsMm } from "../src/domain/pdfImport.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// PDFKit не умеет кириллицу во встроенном Helvetica — используем связанный TTF с кириллицей
// (тот же шрифт применяется в экспортах клиентской сметы, см. src/exports/pdf.ts).
const CYRILLIC_FONT = path.resolve(__dirname, "../assets/fonts/DejaVuSans.ttf");

/**
 * Раздел 23.1: "хотя бы один искусственно изменённый тестовый чертёж с известной
 * геометрией". Мы генерируем синтетический PDF через pdfkit (уже используется для
 * экспортов) с заведомо известным текстом/размерами и проверяем, что реальный
 * pdfjs-извлекатель (не заглушка) достаёт именно эти данные.
 */
function buildTestPdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("cyrillic", CYRILLIC_FONT).font("cyrillic");
    doc.fontSize(14).text("Экспликация помещений — тестовый лист 1");
    doc.text("Гостиная 4500 мм x 6000 мм");
    doc.text("Спальня 3500 мм");
    doc.addPage();
    doc.fontSize(14).text("Фасад северный");
    doc.text("Высота стены 2370 мм");
    doc.end();
  });
}

describe("раздел 20.1: реальное извлечение текста из PDF (не подстановка по имени файла)", () => {
  it("извлекает текст, классифицирует страницы и находит числа-кандидаты на размеры", async () => {
    const buffer = await buildTestPdf();
    const result = await runPdfImportPipeline(buffer);

    expect(result.status).toBe("needs_review");
    expect(result.pageCount).toBe(2);
    expect(result.sha256).toHaveLength(64);

    expect(result.pages[0].classification).toBe("explication");
    expect(result.pages[0].text).toContain("Гостиная");
    expect(result.pages[0].candidateDimensionsMm).toEqual(expect.arrayContaining([4500, 6000, 3500]));

    expect(result.pages[1].classification).toBe("facade");
    expect(result.pages[1].candidateDimensionsMm).toEqual(expect.arrayContaining([2370]));
  });

  it("повторная загрузка того же файла даёт тот же SHA-256 (защита от дублирования)", async () => {
    const buffer = await buildTestPdf();
    const first = await runPdfImportPipeline(buffer);
    const second = await runPdfImportPipeline(buffer);
    expect(first.sha256).toBe(second.sha256);
  });
});

describe("классификация страниц по ключевым словам", () => {
  it("не путает мебель/размерные линии со стенами — здесь просто проверяем, что несвязанный текст не классифицируется ошибочно", () => {
    expect(classifyPageText("Список мебели: диван, кресло")).toBe("unclassified");
    expect(classifyPageText("Свайное поле, координаты опор")).toBe("pile_scheme");
  });

  it("извлекает только правдоподобные размеры (50-20000 мм), отсекая случайные короткие числа", () => {
    expect(extractCandidateDimensionsMm("Страница 5 из 12, масштаб М1:100, размер 4050 мм")).toEqual([4050]);
  });
});

describe("извлечение размеров по фрагментам pdfjs (регресс на реальном чертеже «Барн 93 V2»)", () => {
  it("не путает дробную часть площади из ведомости помещений (запятая) с размером в мм", () => {
    // Реальный экспорт pdfjs отдаёт площадь одним фрагментом: "4,72", "79,08 м²" и т.д.
    // Раньше побайтовый regex по склеенному тексту вырезал из них "72" и "79" как фиктивные
    // "размеры" — оба числа попадали в диапазон 50-20000 мм.
    const fragments = ["Площадь, м2", "4,72", "26,86", "5,02", "11,93", "79,08 м²"];
    expect(extractCandidateDimensionsMm(fragments)).toEqual([]);
  });

  it("правильно читает размер с разделителем тысяч внутри одного фрагмента, не сливая соседние размеры", () => {
    // "9 000"/"11 000" — pdfjs отдаёт их ОДНИМ фрагментом с пробелом внутри. "220" и "920" —
    // два РАЗНЫХ соседних размера на чертеже, каждый свой отдельный фрагмент. Наивное
    // склеивание всей страницы в одну строку через join(" ") делает эти два случая
    // неотличимыми друг от друга ("220 920" выглядит как "9 000" точно так же).
    const fragments = ["3 450", "600", "220", "920", "9 000", "11 000"];
    expect(extractCandidateDimensionsMm(fragments)).toEqual(
      expect.arrayContaining([3450, 600, 220, 920, 9000, 11000])
    );
    // Критично: два отдельных фрагмента "220" и "920" не должны склеиться в один "220920".
    expect(extractCandidateDimensionsMm(fragments)).not.toContain(220920);
  });
});
