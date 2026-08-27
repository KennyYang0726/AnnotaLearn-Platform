"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadPdfJs } from "@/lib/pdf-client";

type NoteType = "KEY_POINT" | "QUESTION";
type HighlightType = "IMPORTANT" | "QUESTION";
type HighlightColor = "RED" | "YELLOW";
type UnderstandingStatus = "UNDERSTOOD" | "NOT_UNDERSTOOD";
type VisitEndReason = "NAVIGATION" | "HIDDEN" | "PAGEHIDE" | "UNMOUNT" | "BLUR" | "IDLE";
const HEARTBEAT_INTERVAL_MS = 10_000;
const READER_IDLE_TIMEOUT_MS = 5 * 60_000;
type Point = [number, number];

type Note = { id: string; page: number; type: NoteType; content: string; recordedAt: string };
type Highlight = { id: string; page: number; type: HighlightType; color: HighlightColor; extractedText?: string | null; points: Point[]; recordedAt: string };
type TextBox = { text: string; x: number; y: number; width: number; height: number };

type PdfPageLike = {
  getViewport(args: { scale: number }): { width: number; height: number; scale: number; transform: number[] };
  render(args: { canvasContext: CanvasRenderingContext2D; viewport: unknown; canvas?: HTMLCanvasElement }): { promise: Promise<void>; cancel(): void };
  getTextContent(): Promise<{ items: Array<Record<string, unknown>> }>;
};
type PdfDocumentLike = { numPages: number; getPage(page: number): Promise<PdfPageLike> };
type PdfLoadingTaskLike = { promise: Promise<PdfDocumentLike>; destroy(): Promise<void> };

type Draft = {
  currentPage: number;
  splitPercent?: number;
  notes: Note[];
  highlights: Highlight[];
  updatedAt?: string;
};

function matrixMultiply(a: number[], b: number[]) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function strokeColor(color: HighlightColor) {
  return color === "RED" ? "rgba(239,68,68,0.42)" : "rgba(250,204,21,0.48)";
}

function validDraft(value: unknown): value is Draft {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.currentPage === "number" && Array.isArray(v.notes) && Array.isArray(v.highlights);
}

export default function ReaderClient({ resourceId, courseId, studentId, title, allowDownload }: { resourceId: string; courseId: string; studentId: string; title: string; allowDownload: boolean }) {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<PdfDocumentLike | null>(null);
  const pdfLoadingTaskRef = useRef<PdfLoadingTaskLike | null>(null);
  const textBoxesRef = useRef<TextBox[]>([]);
  const activeStrokeRef = useRef<Point[] | null>(null);
  const readerSessionIdRef = useRef("");
  const activeVisitIdRef = useRef<string | null>(null);
  const activeVisitPageRef = useRef<number | null>(null);
  const startingVisitRef = useRef(false);
  const lastInteractionAtRef = useRef(Date.now());

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [notes, setNotes] = useState<Note[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [understandingByPage, setUnderstandingByPage] = useState<Record<number, UnderstandingStatus>>({});
  const [understandingSaving, setUnderstandingSaving] = useState(false);
  const [pageGateMessage, setPageGateMessage] = useState("");
  const [trackingNotice, setTrackingNotice] = useState("");
  const [tool, setTool] = useState<HighlightColor | null>(null);
  const [splitPercent, setSplitPercent] = useState(70);
  const [layoutMode, setLayoutMode] = useState<"SPLIT" | "PDF" | "NOTES">("SPLIT");
  const [noteTab, setNoteTab] = useState<"CURRENT" | "ALL">("CURRENT");
  const [ready, setReady] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [error, setError] = useState("");
  const [restored, setRestored] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successAt, setSuccessAt] = useState<string | null>(null);

  const draftKey = `annotalearn-draft:${studentId}:${resourceId}`;
  const currentUnderstanding = understandingByPage[currentPage];
  const pageNavigationLocked = !currentUnderstanding || understandingSaving;

  useEffect(() => {
    if (!readerSessionIdRef.current) readerSessionIdRef.current = crypto.randomUUID();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [submissionResponse, readingResponse] = await Promise.all([
          fetch(`/api/resources/${resourceId}/submission`, { cache: "no-store" }),
          fetch(`/api/resources/${resourceId}/reading`, { cache: "no-store" }),
        ]);
        const [submissionData, readingData] = await Promise.all([submissionResponse.json(), readingResponse.json()]);
        if (!submissionResponse.ok) throw new Error(submissionData.error || "無法載入既有筆記");
        if (!readingResponse.ok) throw new Error(readingData.error || "無法載入閱讀紀錄");
        if (cancelled) return;

        if (submissionData.submission) {
          setCurrentPage(submissionData.submission.lastPage || 1);
          setNotes((submissionData.submission.notes || []).map((note: Note) => ({ ...note, recordedAt: note.recordedAt || new Date().toISOString() })));
          setHighlights((submissionData.submission.highlights || []).map((highlight: Highlight) => ({ ...highlight, recordedAt: highlight.recordedAt || new Date().toISOString() })));
        }

        const understanding: Record<number, UnderstandingStatus> = {};
        for (const item of readingData.understanding || []) {
          if (item.status === "UNDERSTOOD" || item.status === "NOT_UNDERSTOOD") understanding[item.page] = item.status;
        }
        setUnderstandingByPage(understanding);

        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const draft = JSON.parse(raw) as unknown;
          if (validDraft(draft)) {
            setCurrentPage(draft.currentPage || 1);
            const fallbackRecordedAt = typeof draft.updatedAt === "string" ? draft.updatedAt : new Date().toISOString();
            setNotes(draft.notes.map((note) => ({ ...note, recordedAt: note.recordedAt || fallbackRecordedAt })));
            setHighlights(draft.highlights.map((highlight) => ({ ...highlight, recordedAt: highlight.recordedAt || fallbackRecordedAt })));
            if (typeof draft.splitPercent === "number") setSplitPercent(draft.splitPercent);
            setRestored(true);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "載入筆記失敗");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [draftKey, resourceId]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ currentPage, splitPercent, notes, highlights, updatedAt: new Date().toISOString() }));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [currentPage, draftKey, highlights, notes, ready, splitPercent]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPdfLoading(true);
      try {
        const accessResponse = await fetch(`/api/resources/${resourceId}/access`, { cache: "no-store" });
        const access = await accessResponse.json();
        if (!accessResponse.ok) throw new Error(access.error || "無法取得PDF權限");
        const pdfjs = await loadPdfJs();
        const task = pdfjs.getDocument({
          url: access.url,
          withCredentials: access.url.startsWith("/"),
          disableRange: access.url.startsWith("/"),
          disableStream: access.url.startsWith("/"),
        }) as unknown as PdfLoadingTaskLike;
        pdfLoadingTaskRef.current = task;
        const doc = await task.promise;
        if (cancelled) return;
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setCurrentPage((p) => Math.min(Math.max(1, p), doc.numPages));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "PDF載入失敗");
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      pdfDocRef.current = null;
      const task = pdfLoadingTaskRef.current;
      pdfLoadingTaskRef.current = null;
      if (task) void task.destroy();
    };
  }, [resourceId]);

  const startVisit = useCallback(async (page: number) => {
    if (!ready || !numPages || document.visibilityState !== "visible" || !document.hasFocus() || activeVisitIdRef.current || startingVisitRef.current) return;
    if (!readerSessionIdRef.current) readerSessionIdRef.current = crypto.randomUUID();
    startingVisitRef.current = true;
    const clientVisitId = crypto.randomUUID();
    activeVisitIdRef.current = clientVisitId;
    activeVisitPageRef.current = page;
    try {
      const response = await fetch(`/api/resources/${resourceId}/reading`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ENTER", page, clientVisitId, readerSessionId: readerSessionIdRef.current }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "無法建立閱讀時間紀錄");
      setTrackingNotice("");
    } catch (e) {
      if (activeVisitIdRef.current === clientVisitId) {
        activeVisitIdRef.current = null;
        activeVisitPageRef.current = null;
      }
      setTrackingNotice(e instanceof Error ? `閱讀紀錄暫時無法同步：${e.message}` : "閱讀紀錄暫時無法同步");
    } finally {
      startingVisitRef.current = false;
    }
  }, [numPages, ready, resourceId]);

  const endVisit = useCallback(async (reason: VisitEndReason, keepalive = false) => {
    const clientVisitId = activeVisitIdRef.current;
    if (!clientVisitId) return;
    activeVisitIdRef.current = null;
    activeVisitPageRef.current = null;
    try {
      await fetch(`/api/resources/${resourceId}/reading`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "LEAVE", clientVisitId, reason }),
        keepalive,
      });
    } catch {
      // Heartbeat has already persisted accumulated time. A failed final leave
      // therefore cannot inflate an abandoned tab into a very long visit.
    }
  }, [resourceId]);

  useEffect(() => {
    if (!ready || !numPages) return;
    void startVisit(currentPage);
  }, [currentPage, numPages, ready, startVisit]);

  useEffect(() => {
    if (!ready || !numPages) return;
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      if (Date.now() - lastInteractionAtRef.current >= READER_IDLE_TIMEOUT_MS) {
        void endVisit("IDLE", true);
        return;
      }
      const clientVisitId = activeVisitIdRef.current;
      if (!clientVisitId) {
        void startVisit(currentPage);
        return;
      }
      try {
        const response = await fetch(`/api/resources/${resourceId}/reading`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "HEARTBEAT", clientVisitId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Heartbeat失敗");
        if (data.active === false && activeVisitIdRef.current === clientVisitId) {
          activeVisitIdRef.current = null;
          activeVisitPageRef.current = null;
          void startVisit(currentPage);
        }
      } catch {
        // A transient heartbeat failure is retried on the next interval.
      }
    }, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [currentPage, numPages, ready, resourceId, startVisit]);

  useEffect(() => {
    function markInteraction() {
      lastInteractionAtRef.current = Date.now();
      if (document.visibilityState === "visible" && document.hasFocus() && !activeVisitIdRef.current) {
        void startVisit(currentPage);
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") void endVisit("HIDDEN", true);
      else {
        lastInteractionAtRef.current = Date.now();
        void startVisit(currentPage);
      }
    }
    function onFocus() {
      lastInteractionAtRef.current = Date.now();
      void startVisit(currentPage);
    }
    function onBlur() { void endVisit("BLUR", true); }
    function onPageHide() { void endVisit("PAGEHIDE", true); }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pointerdown", markInteraction, { passive: true });
    window.addEventListener("keydown", markInteraction);
    window.addEventListener("wheel", markInteraction, { passive: true });
    window.addEventListener("touchstart", markInteraction, { passive: true });

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pointerdown", markInteraction);
      window.removeEventListener("keydown", markInteraction);
      window.removeEventListener("wheel", markInteraction);
      window.removeEventListener("touchstart", markInteraction);
      void endVisit("UNMOUNT", true);
    };
  }, [currentPage, endVisit, startVisit]);

  const drawHighlights = useCallback((active?: { color: HighlightColor; points: Point[] }) => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const draw = (color: HighlightColor, points: Point[]) => {
      if (points.length < 2) return;
      ctx.save();
      ctx.strokeStyle = strokeColor(color);
      ctx.lineWidth = Math.max(12, canvas.width * 0.018);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(points[0][0] * canvas.width, points[0][1] * canvas.height);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0] * canvas.width, points[i][1] * canvas.height);
      ctx.stroke();
      ctx.restore();
    };
    highlights.filter((h) => h.page === currentPage).forEach((h) => draw(h.color, h.points));
    if (active) draw(active.color, active.points);
  }, [currentPage, highlights]);

  useEffect(() => { drawHighlights(); }, [drawHighlights, layoutMode]);

  useEffect(() => {
    const doc = pdfDocRef.current;
    const pdfCanvas = pdfCanvasRef.current;
    const annotationCanvas = annotationCanvasRef.current;
    if (!doc || !pdfCanvas || !annotationCanvas || !numPages) return;
    let cancelled = false;
    let renderTask: { promise: Promise<void>; cancel(): void } | null = null;
    (async () => {
      try {
        const page = await doc.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.35 });
        pdfCanvas.width = Math.ceil(viewport.width);
        pdfCanvas.height = Math.ceil(viewport.height);
        annotationCanvas.width = pdfCanvas.width;
        annotationCanvas.height = pdfCanvas.height;
        annotationCanvas.style.width = `${pdfCanvas.width}px`;
        annotationCanvas.style.height = `${pdfCanvas.height}px`;
        const ctx = pdfCanvas.getContext("2d");
        if (!ctx) return;
        const task = page.render({ canvasContext: ctx, viewport, canvas: pdfCanvas });
        renderTask = task;
        await task.promise;
        const content = await page.getTextContent();
        const boxes: TextBox[] = [];
        for (const raw of content.items) {
          if (typeof raw.str !== "string" || !Array.isArray(raw.transform)) continue;
          const transform = raw.transform as number[];
          const tx = matrixMultiply(viewport.transform, transform);
          const fontHeight = Math.max(1, Math.hypot(tx[2], tx[3]));
          const width = Math.max(1, Number(raw.width || 0) * viewport.scale);
          boxes.push({ text: raw.str, x: tx[4], y: tx[5] - fontHeight, width, height: fontHeight * 1.25 });
        }
        if (!cancelled) {
          textBoxesRef.current = boxes;
          drawHighlights();
        }
      } catch (e) {
        if (!cancelled && e instanceof Error && !e.message.toLowerCase().includes("cancel")) setError(e.message);
      }
    })();
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [currentPage, drawHighlights, numPages, layoutMode]);

  function canvasPoint(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = annotationCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];
  }

  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!tool) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    activeStrokeRef.current = [canvasPoint(event)];
  }

  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!tool || !activeStrokeRef.current) return;
    event.preventDefault();
    const next = canvasPoint(event);
    const last = activeStrokeRef.current[activeStrokeRef.current.length - 1];
    const distance = Math.hypot(next[0] - last[0], next[1] - last[1]);
    if (distance < 0.0015) return;
    activeStrokeRef.current.push(next);
    drawHighlights({ color: tool, points: activeStrokeRef.current });
  }

  function finishStroke(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!tool || !activeStrokeRef.current) return;
    const points = activeStrokeRef.current;
    activeStrokeRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    if (points.length < 2) {
      drawHighlights();
      return;
    }
    const canvas = annotationCanvasRef.current!;
    const px = points.map(([x, y]) => [x * canvas.width, y * canvas.height] as Point);
    const minX = Math.min(...px.map((p) => p[0]));
    const maxX = Math.max(...px.map((p) => p[0]));
    const minY = Math.min(...px.map((p) => p[1]));
    const maxY = Math.max(...px.map((p) => p[1]));
    const text = textBoxesRef.current
      .filter((b) => b.x <= maxX && b.x + b.width >= minX && b.y <= maxY && b.y + b.height >= minY)
      .map((b) => b.text.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const next: Highlight = {
      id: crypto.randomUUID(),
      page: currentPage,
      type: tool === "RED" ? "IMPORTANT" : "QUESTION",
      color: tool,
      extractedText: text || null,
      points,
      recordedAt: new Date().toISOString(),
    };
    setHighlights((prev) => [...prev, next]);
  }

  function addNote(type: NoteType) {
    setNotes((prev) => [...prev, { id: crypto.randomUUID(), page: currentPage, type, content: "", recordedAt: new Date().toISOString() }]);
  }
  function updateNote(id: string, content: string) { setNotes((prev) => prev.map((n) => n.id === id ? { ...n, content } : n)); }
  function deleteNote(id: string) { setNotes((prev) => prev.filter((n) => n.id !== id)); }
  function undoHighlight() { setHighlights((prev) => { const index = [...prev].map((h) => h.page).lastIndexOf(currentPage); return index < 0 ? prev : prev.filter((_, i) => i !== index); }); }
  function clearPageHighlights() { if (window.confirm(`確定清除第${currentPage}頁的所有劃記？`)) setHighlights((prev) => prev.filter((h) => h.page !== currentPage)); }

  async function chooseUnderstanding(status: UnderstandingStatus) {
    if (understandingSaving || understandingByPage[currentPage] === status) return;
    setUnderstandingSaving(true);
    setPageGateMessage("");
    try {
      const response = await fetch(`/api/resources/${resourceId}/reading`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "UNDERSTANDING", page: currentPage, status }),
        keepalive: true,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "理解狀態儲存失敗");
      setUnderstandingByPage((prev) => ({ ...prev, [currentPage]: status }));
    } catch (e) {
      setPageGateMessage(e instanceof Error ? e.message : "理解狀態儲存失敗");
    } finally {
      setUnderstandingSaving(false);
    }
  }

  async function navigateTo(page: number) {
    if (!Number.isInteger(page) || page < 1 || page > numPages || page === currentPage) return;
    if (!understandingByPage[currentPage]) {
      setPageGateMessage("請先選擇「我懂了」或「我不懂」，才能切換頁面。");
      return;
    }
    if (understandingSaving) return;
    setPageGateMessage("");
    await endVisit("NAVIGATION");
    setCurrentPage(page);
  }

  const shownNotes = useMemo(() => noteTab === "CURRENT" ? notes.filter((n) => n.page === currentPage) : [...notes].sort((a, b) => a.page - b.page), [currentPage, noteTab, notes]);

  function startResize(event: React.MouseEvent) {
    if (layoutMode !== "SPLIT") return;
    event.preventDefault();
    const move = (e: MouseEvent) => setSplitPercent(Math.min(82, Math.max(45, (e.clientX / window.innerWidth) * 100)));
    const stop = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", stop);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
  }

  const pageControls = (className = "") => <div className={`reader-controls ${className}`.trim()}>
    <button className="btn" disabled={currentPage <= 1 || pageNavigationLocked} onClick={() => void navigateTo(currentPage - 1)}>←上一頁</button>
    <div className="row">
      <span>跳至</span>
      <input aria-label="跳頁" type="number" min={1} max={numPages || 1} value={currentPage} disabled={pageNavigationLocked} onChange={(e) => { const page = Number(e.target.value); if (Number.isInteger(page)) void navigateTo(page); }} style={{ width: 82 }} />
      <span>頁</span>
    </div>
    <button className="btn" disabled={!numPages || currentPage >= numPages || pageNavigationLocked} onClick={() => void navigateTo(currentPage + 1)}>下一頁→</button>
    {!currentUnderstanding && <span className="reader-page-gate">請先選擇本頁理解狀態</span>}
  </div>;

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        lastPage: currentPage,
        notes: notes.filter((n) => n.content.trim()).map((n) => ({ ...n, content: n.content.trim() })),
        highlights,
      };
      const response = await fetch(`/api/resources/${resourceId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "繳交失敗");
      localStorage.removeItem(draftKey);
      setRestored(false);
      setSuccessAt(data.submittedAt || new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "繳交失敗，內容仍保留於瀏覽器暫存");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="reader-page" style={{ position: "fixed", inset: 0, zIndex: 20 }}>
    <header className="reader-topbar">
      <div className="row"><Link className="btn btn-outline" href={`/courses/${courseId}`}>←返回課程</Link>{allowDownload && <a className="btn btn-outline" href={`/api/resources/${resourceId}/download`}>下載教材</a>}<strong>{title}</strong></div>
      <div className="reader-topbar-actions">
        <div className="reader-view-switcher">
          <button className={`btn btn-compact ${layoutMode === "PDF" ? "btn-primary" : "btn-outline"}`} onClick={() => setLayoutMode("PDF")}>展開教材</button>
          <button className={`btn btn-compact ${layoutMode === "SPLIT" ? "btn-primary" : "btn-outline"}`} onClick={() => setLayoutMode("SPLIT")}>左右並排</button>
          <button className={`btn btn-compact ${layoutMode === "NOTES" ? "btn-primary" : "btn-outline"}`} onClick={() => setLayoutMode("NOTES")}>展開筆記</button>
        </div>
        <div className="row"><span className="subtle">第{currentPage} / {numPages || "…"}頁</span><span className="badge">筆記自動暫存</span></div>
      </div>
    </header>
    <div className="reader-body">
      {layoutMode !== "NOTES" && <section className="pdf-pane" style={{ width: layoutMode === "PDF" ? "100%" : `${splitPercent}%` }}>
        <div className="reader-tools">
          <button className={`btn ${tool === "RED" ? "tool-active-red" : ""}`} onClick={() => setTool(tool === "RED" ? null : "RED")}>紅色螢光筆：重點</button>
          <button className={`btn ${tool === "YELLOW" ? "tool-active-yellow" : ""}`} onClick={() => setTool(tool === "YELLOW" ? null : "YELLOW")}>黃色螢光筆：疑問</button>
          <button className="btn" onClick={undoHighlight}>復原本頁最後劃記</button>
          <button className="btn btn-danger" onClick={clearPageHighlights}>清除本頁劃記</button>
          <span className="reader-tool-divider" aria-hidden="true" />
          <button className={`btn understanding-button ${currentUnderstanding === "UNDERSTOOD" ? "understanding-active-yes" : ""}`} disabled={understandingSaving} onClick={() => void chooseUnderstanding("UNDERSTOOD")}>我懂了</button>
          <button className={`btn understanding-button ${currentUnderstanding === "NOT_UNDERSTOOD" ? "understanding-active-no" : ""}`} disabled={understandingSaving} onClick={() => void chooseUnderstanding("NOT_UNDERSTOOD")}>我不懂</button>
          {layoutMode === "PDF" && <button className="btn btn-outline" onClick={() => setLayoutMode("SPLIT")}>顯示筆記區</button>}
          {(pageGateMessage || trackingNotice) && <div className={pageGateMessage ? "reader-gate-message" : "reader-tracking-notice"}>{pageGateMessage || trackingNotice}</div>}
        </div>
        <div className="pdf-stage">
          {pdfLoading && <div className="card panel">PDF載入中…</div>}
          <div className="canvas-wrap" style={{ display: pdfLoading ? "none" : "block" }}>
            <canvas ref={pdfCanvasRef} />
            <canvas ref={annotationCanvasRef} className="annotation-canvas" style={{ cursor: tool ? "crosshair" : "default", pointerEvents: tool ? "auto" : "none" }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={finishStroke} onPointerCancel={finishStroke} />
          </div>
        </div>
        {pageControls()}
      </section>}
      {layoutMode === "SPLIT" && <div className="splitter" onMouseDown={startResize} title="拖曳調整PDF與筆記寬度" />}
      {layoutMode !== "PDF" && <aside className="notes-pane" style={{ width: layoutMode === "NOTES" ? "100%" : `${100 - splitPercent}%` }}>
        <div className="notes-head"><div className="between"><div><strong>我的筆記</strong></div><div className="row"><span className="badge">{notes.length}則</span>{layoutMode === "NOTES" && <button className="btn btn-outline btn-compact" onClick={() => setLayoutMode("SPLIT")}>顯示教材區</button>}</div></div>{restored && <div className="restore-banner" style={{ marginTop: 10 }}>已恢復此瀏覽器上次未送出的暫存內容。</div>}{error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}</div>
        <div className="notes-tabs"><button className={`btn ${noteTab === "CURRENT" ? "btn-primary" : ""}`} onClick={() => setNoteTab("CURRENT")}>本頁</button><button className={`btn ${noteTab === "ALL" ? "btn-primary" : ""}`} onClick={() => setNoteTab("ALL")}>全部筆記</button></div>
        <div className="notes-list">
          <div className="notes-actions"><button className="btn btn-primary" onClick={() => addNote("KEY_POINT")}>新增重點</button><button className="btn btn-outline" onClick={() => addNote("QUESTION")}>新增盲點提問</button></div>
          {shownNotes.length === 0 && <div className="subtle">目前尚無筆記。</div>}
          {shownNotes.map((note) => <article className="note-card" key={note.id}><div className="note-meta"><span>{note.type === "KEY_POINT" ? "重點" : "盲點提問"} / 第{note.page}頁</span>{note.page !== currentPage && <button className="btn" style={{ padding: "4px 7px" }} onClick={() => void navigateTo(note.page)}>前往第{note.page}頁</button>}</div><textarea value={note.content} onChange={(e) => updateNote(note.id, e.target.value)} placeholder={note.type === "KEY_POINT" ? "輸入本頁重要概念" : "輸入待釐清的問題"} /><button className="btn btn-danger" onClick={() => deleteNote(note.id)}>刪除筆記</button></article>)}
        </div>
        {layoutMode === "NOTES" && pageControls("notes-full-page-controls")}
        <div className="submit-bar"><button className="btn btn-primary" style={{ width: "100%" }} onClick={submit} disabled={submitting}>{submitting ? "繳交中…" : "繳交教材筆記"}</button></div>
      </aside>}
    </div>
    {successAt && <div className="modal-backdrop"><div className="card modal stack"><h2 className="h2">作業已成功繳交</h2><div className="subtle">寫入時間：{new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(successAt))}</div><button className="btn btn-primary" onClick={() => setSuccessAt(null)}>繼續查看</button><Link className="btn btn-outline" href={`/courses/${courseId}`}>返回課程頁面</Link></div></div>}
  </div>;
}
