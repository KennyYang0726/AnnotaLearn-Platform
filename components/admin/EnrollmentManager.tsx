"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Student = { id: string; username: string; displayName?: string | null; enrolled: boolean };
export default function EnrollmentManager({ courseId, students }: { courseId: string; students: Student[] }) {
  const router = useRouter(); const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState("");
  async function toggle(student: Student) {
    setBusy(student.id); setError("");
    const response = await fetch("/api/admin/enrollments", { method: student.enrolled ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, userId: student.id }) });
    const data = await response.json(); if (!response.ok) setError(data.error || "操作失敗"); else router.refresh(); setBusy(null);
  }
  return <div className="stack">{error && <div className="error">{error}</div>}<div className="table-wrap"><table><thead><tr><th>學號</th><th>姓名</th><th>狀態</th><th></th></tr></thead><tbody>{students.map((s) => <tr key={s.id}><td>{s.username}</td><td>{s.displayName || "—"}</td><td>{s.enrolled ? <span className="badge">已分配</span> : "未分配"}</td><td><button className={`btn ${s.enrolled ? "btn-danger" : "btn-primary"}`} disabled={busy === s.id} onClick={() => toggle(s)}>{s.enrolled ? "移出課程" : "加入課程"}</button></td></tr>)}</tbody></table></div></div>;
}
