import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// Vite ?url импорт — даёт готовый URL воркера как статический ассет, без ручной настройки CDN.
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { getToken } from "../api";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

/**
 * Раздел 7.4/20.1: показ настоящей страницы исходного PDF планировки как картинки — там, где
 * реальный файл действительно загружен и его sha256 подтверждён (см. sourceFileAvailable в
 * каталоге). Рендерится на клиенте через pdfjs-dist в <canvas>, без серверных нативных
 * зависимостей вроде @napi-rs/canvas — тот же риск кросс-платформенных нативных бинарников,
 * что уже проявился в этой сессии с esbuild/Prisma на Windows.
 */
export function RealPdfPage({
  catalogProjectId,
  pageNumber,
  maxWidthPx = 640,
}: {
  catalogProjectId: string;
  pageNumber: number;
  maxWidthPx?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: ReturnType<pdfjsLib.PDFPageProxy["render"]> | null = null;
    setLoading(true);
    setError(null);

    async function run() {
      try {
        const token = getToken();
        const res = await fetch(`/api/catalog/projects/${catalogProjectId}/source-pdf`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Исходный PDF недоступен");
        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (cancelled) return;
        const page = await doc.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = maxWidthPx / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
        if (!cancelled) setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Не удалось отрисовать страницу PDF");
          setLoading(false);
        }
      }
    }
    run();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [catalogProjectId, pageNumber, maxWidthPx]);

  if (error) return <p className="muted">{error}</p>;
  return (
    <div>
      {loading && <p className="muted">Загрузка страницы PDF…</p>}
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          maxWidth: maxWidthPx,
          border: "1px solid #e3e2de",
          borderRadius: 8,
          display: loading ? "none" : "block",
        }}
      />
    </div>
  );
}
