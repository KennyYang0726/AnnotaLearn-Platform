"use client";

import { useMemo, useState } from "react";

type ViewType = "NOTE" | "HIGHLIGHT" | "VISIT";

type NoteItem = {
  id: string;
  type: "KEY_POINT" | "QUESTION";
  page: number;
  content: string;
  recordedAt: string;
};

type HighlightItem = {
  id: string;
  color: string;
  page: number;
  extractedText: string;
  pointCount: number;
  recordedAt: string;
};

type VisitItem = {
  id: string;
  page: number;
  occurrence: number;
  duration: string;
};

export default function StudentReadingRecordViewer({
  notes,
  highlights,
  visits,
  initialView = "NOTE",
}: {
  notes: NoteItem[];
  highlights: HighlightItem[];
  visits: VisitItem[];
  initialView?: ViewType;
}) {
  const [view, setView] = useState<ViewType>(initialView);
  const counts = useMemo(() => ({ NOTE: notes.length, HIGHLIGHT: highlights.length, VISIT: visits.length }), [notes.length, highlights.length, visits.length]);

  return <section className="card panel stack">
    <div className="record-view-select-row">
      <label>檢視內容
        <select value={view} onChange={(event) => setView(event.target.value as ViewType)}>
          <option value="NOTE">文字筆記（{counts.NOTE}）</option>
          <option value="HIGHLIGHT">PDF劃記（{counts.HIGHLIGHT}）</option>
          <option value="VISIT">停留時間紀錄（{counts.VISIT}）</option>
        </select>
      </label>
    </div>

    {view === "NOTE" && <div className="stack">
      <h2 className="h2" style={{ margin: 0 }}>文字筆記</h2>
      {notes.length === 0 ? <div className="subtle">此篩選條件下沒有文字筆記。</div> : notes.map((note) => <article className="note-card" key={note.id}>
        <div className="note-meta"><span>{note.type === "KEY_POINT" ? "重點" : "盲點提問"} / P.{note.page}</span><span>{note.recordedAt}</span></div>
        <div>{note.content}</div>
      </article>)}
    </div>}

    {view === "HIGHLIGHT" && <div className="stack">
      <h2 className="h2" style={{ margin: 0 }}>PDF劃記</h2>
      {highlights.length === 0 ? <div className="subtle">此篩選條件下沒有PDF劃記。</div> : highlights.map((highlight) => <article className="note-card" key={highlight.id}>
        <div className="note-meta"><span>{highlight.color === "RED" ? "紅色 / 重點" : "黃色 / 疑問"} / P.{highlight.page}</span><span>{highlight.recordedAt}</span></div>
        <div><strong>對應文字：</strong>{highlight.extractedText || "無可擷取文字"}</div>
        <div className="subtle">座標點數：{highlight.pointCount}</div>
      </article>)}
    </div>}

    {view === "VISIT" && <div className="stack">
      <div>
        <h2 className="h2" style={{ marginBottom: 4 }}>停留時間紀錄</h2>
        <div className="subtle">每次進入頁面各自保留，不合併重複造訪；此處僅顯示停留時間，不顯示進入或離開時間。</div>
      </div>
      {visits.length === 0 ? <div className="subtle">此篩選條件下沒有停留時間紀錄。</div> : <div className="table-wrap"><table>
        <thead><tr><th>頁碼</th><th>該頁第幾次停留</th><th>停留時間</th></tr></thead>
        <tbody>{visits.map((visit) => <tr key={visit.id}><td><strong>P.{visit.page}</strong></td><td>第{visit.occurrence}次</td><td><strong>{visit.duration}</strong></td></tr>)}</tbody>
      </table></div>}
    </div>}
  </section>;
}
