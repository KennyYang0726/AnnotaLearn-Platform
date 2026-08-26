"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type PreviewStatus = "NEW" | "EXISTS" | "DUPLICATE" | "INVALID" | "CONFLICT";
type PreviewRow = {
  rowNumber: number;
  sequence: string;
  departmentGrade: string;
  studentId: string;
  name: string;
  schoolEmail: string;
  externalEmail: string;
  note: string;
  status: PreviewStatus;
  message: string;
};
type Preview = { rows: PreviewRow[]; summary: { total: number; newCount: number; existingCount: number; skippedCount: number } };
type Course = { id: string; name: string; courseCode: string; semester: string };
type ImportedUser = { id: string; username: string };
type ImportResult = { createdCount: number; existingCount: number; skippedCount: number; users: ImportedUser[] };

function statusLabel(status: PreviewStatus) {
  if (status === "NEW") return "新增";
  if (status === "EXISTS") return "已存在";
  if (status === "DUPLICATE") return "重複";
  if (status === "CONFLICT") return "帳號衝突";
  return "格式錯誤";
}

export default function StudentImportForm({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [courseResult, setCourseResult] = useState<string>("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"PREVIEW" | "IMPORT" | "COURSE" | null>(null);

  const usableCount = useMemo(() => preview ? preview.summary.newCount + preview.summary.existingCount : 0, [preview]);

  function formWithFile() {
    if (!file) throw new Error("請先選擇Excel名單");
    const form = new FormData();
    form.append("file", file);
    return form;
  }

  async function parsePreview() {
    setBusy("PREVIEW"); setError(""); setPreview(null); setImported(null); setCourseResult("");
    try {
      const response = await fetch("/api/admin/students/import/preview", { method: "POST", body: formWithFile() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "名單解析失敗");
      setPreview(data as Preview);
    } catch (e) { setError(e instanceof Error ? e.message : "名單解析失敗"); }
    finally { setBusy(null); }
  }

  async function importStudents() {
    setBusy("IMPORT"); setError(""); setCourseResult("");
    try {
      const response = await fetch("/api/admin/students/import", { method: "POST", body: formWithFile() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "學生匯入失敗");
      setImported(data as ImportResult);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "學生匯入失敗"); }
    finally { setBusy(null); }
  }

  async function addToCourse() {
    if (!imported?.users.length || !courseId) return;
    setBusy("COURSE"); setError(""); setCourseResult("");
    try {
      const response = await fetch("/api/admin/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, userIds: imported.users.map((user) => user.id) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "加入課程失敗");
      setCourseResult(`已加入${data.addedCount}位學生；另有${data.alreadyEnrolledCount}位原本已在此課程。`);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "加入課程失敗"); }
    finally { setBusy(null); }
  }

  function reset() {
    setFile(null); setPreview(null); setImported(null); setCourseResult(""); setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return <div className="stack">
    <section className="card panel stack">
      <div>
        <h2 className="h2">1. 選擇學生名單</h2>
      </div>
      <label>Excel檔案
        <input ref={inputRef} type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); setImported(null); setCourseResult(""); setError(""); }} />
      </label>
      <div className="row">
        <button className="btn btn-primary" onClick={parsePreview} disabled={!file || busy !== null}>{busy === "PREVIEW" ? "解析中…" : "解析並預覽名單"}</button>
        {(preview || imported) && <button className="btn btn-outline" onClick={reset} disabled={busy !== null}>重新選擇</button>}
      </div>
      {error && <div className="error">{error}</div>}
    </section>

    {preview && <section className="card panel stack">
      <div className="between"><div><h2 className="h2">2. 確認匯入內容</h2><div className="subtle">共{preview.summary.total}筆；新增{preview.summary.newCount}筆、既有學生{preview.summary.existingCount}筆、略過{preview.summary.skippedCount}筆。</div></div>
        {!imported && <button className="btn btn-primary" onClick={importStudents} disabled={!usableCount || busy !== null}>{busy === "IMPORT" ? "匯入中…" : `確認匯入${usableCount}位學生`}</button>}
      </div>
      <div className="table-wrap"><table><thead><tr><th>列</th><th>學號</th><th>姓名</th><th>系級</th><th>校內信箱</th><th>狀態</th></tr></thead><tbody>
        {preview.rows.map((row, index) => <tr key={`${row.studentId}-${row.rowNumber}-${index}`}><td>{row.rowNumber}</td><td><strong>{row.studentId}</strong></td><td>{row.name || "—"}</td><td>{row.departmentGrade || "—"}</td><td>{row.schoolEmail || "—"}</td><td><span className="badge">{statusLabel(row.status)}</span><div className="subtle" style={{ marginTop: 4 }}>{row.message}</div></td></tr>)}
      </tbody></table></div>
    </section>}

    {imported && <section className="card panel stack">
      <div><h2 className="h2">3. 學生匯入完成</h2><div className="success">新增{imported.createdCount}位；既有學生{imported.existingCount}位；略過{imported.skippedCount}筆。</div></div>
      <div><strong>將匯入名單加入現有課程</strong></div>
      {courses.length ? <div className="row" style={{ alignItems: "end" }}>
        <label style={{ flex: "1 1 420px" }}>選擇課程
          <select value={courseId} onChange={(event) => { setCourseId(event.target.value); setCourseResult(""); }}>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.semester} / {course.name} / {course.courseCode}</option>)}
          </select>
        </label>
        <button className="btn btn-primary" onClick={addToCourse} disabled={!courseId || !imported.users.length || busy !== null}>{busy === "COURSE" ? "加入中…" : "加入選取課程"}</button>
      </div> : <div className="subtle">目前尚未建立課程，可先完成學生匯入，再到課程管理建立課程。</div>}
      {courseResult && <div className="success">{courseResult}</div>}
      <div className="row"><Link className="btn btn-outline" href="/admin/students">返回學生管理</Link><Link className="btn btn-outline" href="/admin/courses">前往課程列表</Link></div>
    </section>}
  </div>;
}
