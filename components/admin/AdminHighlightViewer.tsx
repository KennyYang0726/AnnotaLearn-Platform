"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadPdfJs } from "@/lib/pdf-client";

type Point = [number, number];
type HighlightColor = "RED" | "YELLOW";
type Student = { id: string; username: string; displayName?: string | null; submitted: boolean; highlightCount: number };
type Highlight = { id: string; studentId: string; username: string; displayName?: string | null; page: number; color: HighlightColor; points: Point[]; strokeWidthRatio?: number; recordedDate: string };
type PdfPageLike = {
  getViewport(args: { scale: number }): { width: number; height: number };
  render(args: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas?: HTMLCanvasElement }): { promise: Promise<void>; cancel(): void };
};
type PdfDocumentLike = { numPages: number; getPage(page: number): Promise<PdfPageLike> };
type PdfLoadingTaskLike = { promise: Promise<PdfDocumentLike>; destroy(): Promise<void> };

function strokeColor(color: HighlightColor) {
  return color === "RED" ? "rgba(239,68,68,0.34)" : "rgba(250,204,21,0.40)";
}

export default function AdminHighlightViewer({ resourceId, title, students, highlights }: { resourceId: string; title: string; students: Student[]; highlights: Highlight[] }) {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<PdfDocumentLike | null>(null);
  const loadingTaskRef = useRef<PdfLoadingTaskLike | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>(students.map((student) => student.id));
  const [showRed, setShowRed] = useState(true);
  const [showYellow, setShowYellow] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [studentKeyword, setStudentKeyword] = useState("");
  const [pdfLoading, setPdfLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const dateAndColorHighlights = useMemo(() => highlights.filter((highlight) => {
    if (highlight.color === "RED" ? !showRed : !showYellow) return false;
    if (fromDate && highlight.recordedDate < fromDate) return false;
    if (toDate && highlight.recordedDate > toDate) return false;
    return true;
  }), [fromDate, highlights, showRed, showYellow, toDate]);
  const filteredCountByStudent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const highlight of dateAndColorHighlights) counts.set(highlight.studentId, (counts.get(highlight.studentId) ?? 0) + 1);
    return counts;
  }, [dateAndColorHighlights]);
  const normalizedKeyword = studentKeyword.trim().toLocaleLowerCase("zh-TW");
  const highlightFiltersActive = Boolean(fromDate || toDate || !showRed || !showYellow);
  const visibleStudents = useMemo(() => students.filter((student) => {
    const matchesKeyword = !normalizedKeyword || `${student.username} ${student.displayName ?? ""}`.toLocaleLowerCase("zh-TW").includes(normalizedKeyword);
    const hasFilteredHighlight = !highlightFiltersActive || (filteredCountByStudent.get(student.id) ?? 0) > 0;
    return matchesKeyword && hasFilteredHighlight;
  }), [filteredCountByStudent, highlightFiltersActive, normalizedKeyword, students]);
  const visibleStudentIds = useMemo(() => new Set(visibleStudents.map((student) => student.id)), [visibleStudents]);
  const visibleHighlights = useMemo(() => dateAndColorHighlights.filter((highlight) => selectedSet.has(highlight.studentId) && visibleStudentIds.has(highlight.studentId)), [dateAndColorHighlights, selectedSet, visibleStudentIds]);
  const pageHighlights = useMemo(() => visibleHighlights.filter((highlight) => highlight.page === currentPage), [currentPage, visibleHighlights]);
  const pageStudentCount = useMemo(() => new Set(pageHighlights.map((highlight) => highlight.studentId)).size, [pageHighlights]);
  const redCount = pageHighlights.filter((highlight) => highlight.color === "RED").length;
  const yellowCount = pageHighlights.filter((highlight) => highlight.color === "YELLOW").length;
  const periodLabel = fromDate && toDate ? `${fromDate}～${toDate}` : fromDate ? `${fromDate}起` : toDate ? `${toDate}以前` : "全部日期";

  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const highlight of pageHighlights) {
      if (highlight.points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = strokeColor(highlight.color);
      ctx.lineWidth = Math.max(12, canvas.width * (highlight.strokeWidthRatio ?? 0.018));
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(highlight.points[0][0] * canvas.width, highlight.points[0][1] * canvas.height);
      for (let index = 1; index < highlight.points.length; index++) ctx.lineTo(highlight.points[index][0] * canvas.width, highlight.points[index][1] * canvas.height);
      ctx.stroke();
      ctx.restore();
    }
  }, [pageHighlights]);

  useEffect(() => { drawOverlay(); }, [drawOverlay]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPdfLoading(true); setError("");
      try {
        const accessResponse = await fetch(`/api/resources/${resourceId}/access`, { cache: "no-store" });
        const access = await accessResponse.json();
        if (!accessResponse.ok) throw new Error(access.error || "無法取得PDF權限");
        const pdfjs = await loadPdfJs();
        const task = pdfjs.getDocument({ url: access.url, withCredentials: access.url.startsWith("/"), disableRange: access.url.startsWith("/"), disableStream: access.url.startsWith("/") }) as unknown as PdfLoadingTaskLike;
        loadingTaskRef.current = task;
        const doc = await task.promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setCurrentPage((page) => Math.min(Math.max(page, 1), doc.numPages));
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "PDF載入失敗"); }
      finally { if (!cancelled) setPdfLoading(false); }
    })();
    return () => { cancelled = true; pdfDocRef.current = null; const task = loadingTaskRef.current; loadingTaskRef.current = null; if (task) void task.destroy(); };
  }, [resourceId]);

  useEffect(() => {
    const doc = pdfDocRef.current; const pdfCanvas = pdfCanvasRef.current; const overlayCanvas = overlayCanvasRef.current;
    if (!doc || !pdfCanvas || !overlayCanvas || !numPages) return;
    let cancelled = false; let renderTask: { promise: Promise<void>; cancel(): void } | null = null;
    (async () => {
      try {
        const page = await doc.getPage(currentPage); const viewport = page.getViewport({ scale: 1.35 });
        pdfCanvas.width = Math.ceil(viewport.width); pdfCanvas.height = Math.ceil(viewport.height); overlayCanvas.width = pdfCanvas.width; overlayCanvas.height = pdfCanvas.height;
        overlayCanvas.style.width = `${pdfCanvas.width}px`; overlayCanvas.style.height = `${pdfCanvas.height}px`;
        const ctx = pdfCanvas.getContext("2d"); if (!ctx) return;
        const task = page.render({ canvasContext: ctx, viewport, canvas: pdfCanvas }); renderTask = task; await task.promise; if (!cancelled) drawOverlay();
      } catch (e) { if (!cancelled && e instanceof Error && !e.message.toLowerCase().includes("cancel")) setError(e.message); }
    })();
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [currentPage, drawOverlay, numPages]);

  function toggleStudent(studentId: string) { setSelectedIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]); }
  function onlyStudent(studentId: string) { setSelectedIds([studentId]); }
  function clearFilters() { setFromDate(""); setToDate(""); setStudentKeyword(""); setShowRed(true); setShowYellow(true); setSelectedIds(students.map((student) => student.id)); }

  return <section className="card admin-highlight-viewer">
    <div className="admin-highlight-toolbar">
      <div><strong>{title}</strong><div className="subtle">第{currentPage} / {numPages || "…"}頁</div></div>
      <div className="row">
        <label className="highlight-toggle"><input type="checkbox" checked={showRed} onChange={(event) => setShowRed(event.target.checked)} />紅色重點</label>
        <label className="highlight-toggle"><input type="checkbox" checked={showYellow} onChange={(event) => setShowYellow(event.target.checked)} />黃色疑問</label>
      </div>
    </div>
    <div className="admin-highlight-date-filter">
      <label>起始日期<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
      <label>結束日期<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
      <label>學生<input value={studentKeyword} onChange={(event) => setStudentKeyword(event.target.value)} placeholder="學號或姓名" /></label>
      <button className="btn btn-outline" type="button" onClick={clearFilters}>清除篩選</button>
      <div className="filter-summary"><strong>篩選期間：</strong>{periodLabel}</div>
    </div>

    {error && <div className="error" style={{ padding: "0 18px 14px" }}>{error}</div>}

    <div className="admin-highlight-body">
      <div className="admin-highlight-pdf">
        <div className="highlight-page-stats"><span className="badge">本頁{pageStudentCount}位學生有劃記</span><span className="badge">紅色{redCount}筆</span><span className="badge">黃色{yellowCount}筆</span></div>
        <div className="pdf-stage admin-highlight-stage">
          {pdfLoading && <div className="card panel">PDF載入中…</div>}
          <div className="canvas-wrap" style={{ display: pdfLoading ? "none" : "block" }}><canvas ref={pdfCanvasRef} /><canvas ref={overlayCanvasRef} className="annotation-canvas admin-highlight-overlay" /></div>
        </div>
        <div className="reader-controls"><button className="btn" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>←上一頁</button><div className="row"><span>跳至</span><input aria-label="跳頁" type="number" min={1} max={numPages || 1} value={currentPage} onChange={(event) => { const page = Number(event.target.value); if (Number.isInteger(page) && page >= 1 && (!numPages || page <= numPages)) setCurrentPage(page); }} style={{ width: 82 }} /><span>頁</span></div><button className="btn" disabled={!numPages || currentPage >= numPages} onClick={() => setCurrentPage((page) => Math.min(numPages, page + 1))}>下一頁→</button></div>
      </div>

      <aside className="admin-highlight-students">
        <div className="between"><div><strong>學生劃記篩選</strong></div><span className="badge">{visibleStudents.filter((student) => selectedSet.has(student.id)).length}/{visibleStudents.length}</span></div>
        <div className="row"><button className="btn btn-outline" onClick={() => setSelectedIds((current) => Array.from(new Set([...current, ...visibleStudents.map((student) => student.id)])))}>顯示篩選結果</button><button className="btn btn-outline" onClick={() => setSelectedIds((current) => current.filter((id) => !visibleStudentIds.has(id)))}>隱藏篩選結果</button></div>
        <div className="highlight-student-list">
          {visibleStudents.length === 0 && <div className="subtle">此篩選期間沒有學生劃記。</div>}
          {visibleStudents.map((student) => { const filteredCount = filteredCountByStudent.get(student.id) ?? 0; return <div className="highlight-student-row" key={student.id}>
            <label className="highlight-student-check"><input type="checkbox" checked={selectedSet.has(student.id)} onChange={() => toggleStudent(student.id)} /><span><strong>{student.username}</strong>{student.displayName ? ` / ${student.displayName}` : ""}<span className="subtle" style={{ display: "block", fontWeight: 400 }}>{student.submitted ? `${filteredCount}筆符合篩選的劃記` : "尚未繳交"}</span></span></label>
            {filteredCount > 0 && <button className="btn" onClick={() => onlyStudent(student.id)}>僅顯示此學生</button>}
          </div>; })}
        </div>
      </aside>
    </div>
  </section>;
}
