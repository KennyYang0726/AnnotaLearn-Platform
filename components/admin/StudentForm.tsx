"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Course = { id: string; name: string; semester: string; courseCode: string };
type Created = { userId: string; username: string; defaultPassword: string };

export default function StudentForm({ courses }: { courses: Course[] }) {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [departmentGrade, setDepartmentGrade] = useState("");
  const [error, setError] = useState("");
  const [existingStudentId, setExistingStudentId] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [courseMessage, setCourseMessage] = useState("");
  const [assigning, setAssigning] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setExistingStudentId(""); setCreated(null); setCourseMessage("");
    const response = await fetch("/api/admin/students", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId, displayName, departmentGrade }) });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 409) {
        setExistingStudentId(studentId.trim().toUpperCase());
        return;
      }
      return setError(data.error || "新增失敗");
    }
    setCreated({ userId: data.userId, username: data.username, defaultPassword: data.defaultPassword });
    setStudentId(""); setDisplayName(""); setDepartmentGrade(""); router.refresh();
  }

  async function assignCourse() {
    if (!created || !courseId) return;
    setAssigning(true); setError(""); setCourseMessage("");
    try {
      const response = await fetch("/api/admin/enrollments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, userId: created.userId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "加入課程失敗");
      setCourseMessage("已將學生加入選取課程。"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "加入課程失敗"); }
    finally { setAssigning(false); }
  }

  return <div className="stack">
    <div className="subtle">此功能用於建立尚未註冊的學生帳號。若學生已有帳號，不需要重複新增，要加入新課程時，請使用課程的「學生分配」或 Excel 名單匯入。</div>
    <form className="stack" onSubmit={submit}>
      <label>學號<input value={studentId} onChange={(e) => { setStudentId(e.target.value.toUpperCase()); setExistingStudentId(""); }} placeholder="B1042019" required /></label>
      <label>姓名（選填）<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="學生姓名" maxLength={100} /></label>
      <label>系籍（選填）<input value={departmentGrade} onChange={(e) => setDepartmentGrade(e.target.value)} placeholder="例如：資訊工程學系3" maxLength={120} /></label>
      {error && <div className="error">{error}</div>}
      <button className="btn btn-primary">確認新增學生</button>
    </form>
    {existingStudentId && <div className="card panel stack" style={{ boxShadow: "none" }}>
      <div>
        <strong>{existingStudentId} 已有學生帳號，不需要再次新增。</strong>
        <div className="subtle" style={{ marginTop: 4 }}>若是新學期或新課程，請到課程列表進入該課程後使用「學生分配」，若要處理整份課程名單，也可以改用 Excel 名單匯入。既有帳號不會因此重設密碼。</div>
      </div>
      <div className="row">
        <Link className="btn btn-primary" href="/admin/courses">前往課程列表</Link>
        <Link className="btn btn-outline" href="/admin/students/import">匯入 Excel 名單</Link>
      </div>
    </div>}
    {created && <div className="card panel stack" style={{ boxShadow: "none" }}>
      <div><strong>帳號建立完成</strong><div>帳號：{created.username}</div><div>一次性預設密碼：{created.defaultPassword}</div></div>
      <div><strong>是否直接加入現有課程？</strong></div>
      {courses.length ? <div className="stack"><label>選擇課程<select value={courseId} onChange={(e) => { setCourseId(e.target.value); setCourseMessage(""); }}>{courses.map((course) => <option key={course.id} value={course.id}>{course.semester} / {course.name} / {course.courseCode}</option>)}</select></label><button type="button" className="btn btn-primary" onClick={assignCourse} disabled={assigning}>{assigning ? "加入中…" : "加入選取課程"}</button></div> : <div className="subtle">目前沒有可加入的課程。</div>}
      {courseMessage && <div className="success">{courseMessage}</div>}
      <div className="row"><Link className="btn btn-outline" href="/admin/courses">前往課程列表</Link><Link className="btn btn-outline" href="/admin/students">返回學生管理</Link></div>
    </div>}
  </div>;
}
