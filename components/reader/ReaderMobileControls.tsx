"use client";

import Link from "next/link";

export type MobileHighlightColor = "RED" | "YELLOW";
export type MobileUnderstandingStatus = "UNDERSTOOD" | "NOT_UNDERSTOOD";

export function ReaderMobileTopbar({
  courseHref,
  title,
  notesCount,
  toolsOpen,
  allowDownload,
  downloadHref,
  submitting,
  onOpenNotes,
  onToggleTools,
  onSubmit,
}: {
  courseHref: string;
  title: string;
  notesCount: number;
  toolsOpen: boolean;
  allowDownload: boolean;
  downloadHref: string;
  submitting: boolean;
  onOpenNotes(): void;
  onToggleTools(): void;
  onSubmit(): void;
}) {
  return <header className="reader-mobile-topbar">
    <Link className="reader-mobile-icon-button" href={courseHref} aria-label="返回課程" title="返回課程">←</Link>
    <strong className="reader-mobile-title" title={title}>{title}</strong>
    <button className="reader-mobile-text-button" type="button" onClick={onOpenNotes}>筆記<span className="reader-mobile-count">{notesCount}</span></button>
    <button className={`reader-mobile-text-button ${toolsOpen ? "is-active" : ""}`} type="button" onClick={onToggleTools}>{toolsOpen ? "收合" : "工具"}</button>
    {allowDownload && <a className="reader-mobile-download-button" href={downloadHref} aria-label="下載教材" title="下載教材">
      <svg className="reader-mobile-download-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
      </svg>
      <span className="reader-mobile-download-label">下載教材</span>
    </a>}
    <button className="reader-mobile-submit-button" type="button" disabled={submitting} onClick={onSubmit}>{submitting ? "繳交中…" : "繳交作業"}</button>
  </header>;
}

export function ReaderMobileTools({
  tool,
  brushSize,
  brushSizeLabels,
  canUndo,
  canClear,
  zoom,
  isLandscape,
  panMode,
  canPan,
  onSelectTool,
  onBrushSizeChange,
  onUndo,
  onClear,
  onDoneDrawing,
  onTogglePan,
  onZoomOut,
  onZoomReset,
  onZoomIn,
}: {
  tool: MobileHighlightColor | null;
  brushSize: number;
  brushSizeLabels: readonly string[];
  canUndo: boolean;
  canClear: boolean;
  zoom: number;
  isLandscape: boolean;
  panMode: boolean;
  canPan: boolean;
  onSelectTool(color: MobileHighlightColor): void;
  onBrushSizeChange(value: number): void;
  onUndo(): void;
  onClear(): void;
  onDoneDrawing(): void;
  onTogglePan(): void;
  onZoomOut(): void;
  onZoomReset(): void;
  onZoomIn(): void;
}) {
  return <div className="reader-mobile-tools" aria-label="PDF閱讀工具">
    {tool && <div className={`reader-mobile-drawing-mode ${panMode ? "is-panning" : ""}`} role="status">
      <span>
        <strong>{panMode ? "移動畫面" : (tool === "RED" ? "重點劃記" : "疑問劃記")}</strong>
        {panMode ? "模式：拖動畫面不會產生劃記" : "模式：單指將用來劃記"}
      </span>
      <div className="reader-mobile-drawing-actions">
        {canPan && <button className="reader-mobile-pan-button" type="button" onClick={onTogglePan}>{panMode ? "繼續劃記" : "移動畫面"}</button>}
        <button type="button" onClick={onDoneDrawing}>完成劃記</button>
      </div>
    </div>}
    <div className="reader-mobile-tool-row">
      <button className={`btn btn-compact ${tool === "RED" ? "tool-active-red" : ""}`} type="button" onClick={() => onSelectTool("RED")}>重點劃記</button>
      <button className={`btn btn-compact ${tool === "YELLOW" ? "tool-active-yellow" : ""}`} type="button" onClick={() => onSelectTool("YELLOW")}>疑問劃記</button>
      <button className="btn btn-compact" type="button" disabled={!canUndo} onClick={onUndo}>↶ 復原上一筆</button>
      <button className="btn btn-danger btn-compact" type="button" disabled={!canClear} onClick={onClear}>清除本頁</button>
    </div>
    <div className="reader-mobile-tool-row reader-mobile-tool-settings">
      <label className="reader-brush-size" title="調整之後新增劃記的筆跡粗細">
        <span>畫筆</span>
        <input aria-label="畫筆粗細" type="range" min={1} max={brushSizeLabels.length} step={1} value={brushSize} onChange={(event) => onBrushSizeChange(Number(event.target.value))} />
        <strong>{brushSizeLabels[brushSize - 1]}</strong>
      </label>
      <div className="reader-mobile-zoom" aria-label="PDF縮放">
        <button type="button" aria-label="縮小PDF" onClick={onZoomOut}>−</button>
        <button type="button" className="reader-mobile-zoom-reset" onClick={onZoomReset}>{Math.round(zoom * 100)}%</button>
        <button type="button" aria-label="放大PDF" onClick={onZoomIn}>＋</button>
      </div>
    </div>
    {isLandscape && <div className="reader-mobile-landscape-hint">此頁為橫向教材，字太小時可旋轉手機或使用 ＋ 放大閱讀。</div>}
  </div>;
}

export function ReaderMobileBottomNav({
  currentPage,
  numPages,
  currentUnderstanding,
  understandingSaving,
  pageNavigationLocked,
  pageGateMessage,
  trackingNotice,
  errorMessage,
  onChooseUnderstanding,
  onPrevious,
  onNext,
  onOpenJump,
}: {
  currentPage: number;
  numPages: number;
  currentUnderstanding?: MobileUnderstandingStatus;
  understandingSaving: boolean;
  pageNavigationLocked: boolean;
  pageGateMessage: string;
  trackingNotice: string;
  errorMessage: string;
  onChooseUnderstanding(status: MobileUnderstandingStatus): void;
  onPrevious(): void;
  onNext(): void;
  onOpenJump(): void;
}) {
  const notice = errorMessage || pageGateMessage || trackingNotice || (!currentUnderstanding ? "選擇本頁理解狀態後即可換頁。" : "");
  const noticeIsError = Boolean(errorMessage || pageGateMessage);
  return <div className="reader-mobile-bottom">
    {notice && <div className={noticeIsError ? "reader-mobile-notice is-error" : "reader-mobile-notice"}>{notice}</div>}
    <div className="reader-mobile-understanding">
      <span>本頁理解</span>
      <button className={`understanding-button ${currentUnderstanding === "UNDERSTOOD" ? "understanding-active-yes" : ""}`} type="button" disabled={understandingSaving} onClick={() => onChooseUnderstanding("UNDERSTOOD")}>我懂了</button>
      <button className={`understanding-button ${currentUnderstanding === "NOT_UNDERSTOOD" ? "understanding-active-no" : ""}`} type="button" disabled={understandingSaving} onClick={() => onChooseUnderstanding("NOT_UNDERSTOOD")}>我不懂</button>
    </div>
    <div className="reader-mobile-navigation">
      <button type="button" aria-label="上一頁" disabled={currentPage <= 1 || pageNavigationLocked} onClick={onPrevious}>‹</button>
      <button className="reader-mobile-page-number" type="button" disabled={!numPages || pageNavigationLocked} onClick={onOpenJump}>{currentPage} / {numPages || "…"}</button>
      <button type="button" aria-label="下一頁" disabled={!numPages || currentPage >= numPages || pageNavigationLocked} onClick={onNext}>›</button>
    </div>
  </div>;
}

export function ReaderMobileFab({
  open,
  hidden,
  onToggle,
  onAddKeyPoint,
  onAddQuestion,
}: {
  open: boolean;
  hidden: boolean;
  onToggle(): void;
  onAddKeyPoint(): void;
  onAddQuestion(): void;
}) {
  if (hidden) return null;
  return <div className={`reader-mobile-fab-wrap ${open ? "is-open" : ""}`}>
    {open && <div className="reader-mobile-fab-actions">
      <button type="button" onClick={onAddKeyPoint}><span>📝</span>重點筆記</button>
      <button type="button" onClick={onAddQuestion}><span>?</span>盲點提問</button>
    </div>}
    <button className="reader-mobile-fab" type="button" aria-label={open ? "收合新增筆記選單" : "新增筆記"} aria-expanded={open} onClick={onToggle}>{open ? "×" : "+"}</button>
  </div>;
}
