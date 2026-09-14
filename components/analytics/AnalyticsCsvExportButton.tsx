"use client";

type CsvCell = string | number | boolean | null | undefined;

type CsvColumn = {
  key: string;
  header: string;
};

function protectSpreadsheetFormula(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function encodeCsvCell(value: CsvCell) {
  if (value == null) return '""';
  const raw = String(value);
  const text = typeof value === "string" ? protectSpreadsheetFormula(raw) : raw;
  return `"${text.replace(/"/g, '""')}"`;
}

function safeFilename(filename: string) {
  const normalized = filename.trim().replace(/[\\/:*?"<>|]/g, "_") || "analytics";
  return normalized.toLowerCase().endsWith(".csv") ? normalized : `${normalized}.csv`;
}

export default function AnalyticsCsvExportButton({
  filename,
  columns,
  rows,
}: {
  filename: string;
  columns: CsvColumn[];
  rows: Array<Record<string, CsvCell>>;
}) {
  function downloadCsv() {
    if (!rows.length) return;

    const header = columns.map((column) => encodeCsvCell(column.header)).join(",");
    const body = rows.map((row) => columns.map((column) => encodeCsvCell(row[column.key])).join(","));
    const csv = `\uFEFF${[header, ...body].join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeFilename(filename);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <button
      type="button"
      className="btn btn-outline btn-compact analytics-csv-export"
      onClick={downloadCsv}
      disabled={!rows.length}
    >
      匯出CSV
    </button>
  );
}
