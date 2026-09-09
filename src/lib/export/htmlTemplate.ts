export function wrapHtmlDocument(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "DejaVu Sans", "Segoe UI", Arial, sans-serif; font-size: 12px; color: #262421; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 18px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .muted { color: #6b675f; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #e4e1d9; font-size: 11.5px; }
  th { background: #f7f6f3; font-weight: 600; }
  .total-row td { font-weight: 700; border-top: 2px solid #262421; }
  .price-box { background: #f7f6f3; border: 1px solid #e4e1d9; border-radius: 8px; padding: 12px 16px; margin: 14px 0; }
  .price-box .amount { font-size: 24px; font-weight: 700; }
  .footer-note { margin-top: 20px; font-size: 10.5px; color: #6b675f; }
  .page-break { page-break-before: always; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatRub(value: number | null): string {
  if (value === null) return "цена не задана";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value) + " ₽";
}
