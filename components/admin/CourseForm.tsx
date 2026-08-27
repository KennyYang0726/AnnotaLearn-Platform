"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CourseForm({ semesters }: { semesters: { id: string; code: string }[] }) {
  const router = useRouter();
  const [semesterId, setSemesterId] = useState(semesters[0]?.id || "");
  const [name, setName] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ semesterId, name, startAt, endAt }),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.error || "建立失敗");
    setName("");
    setStartAt("");
    setEndAt("");
    router.refresh();
  }

  return <form className="stack" onSubmit={submit}>
    <label>學期<select value={semesterId} onChange={(e) => setSemesterId(e.target.value)} required>{semesters.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select></label>
    <label>課程名稱<input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：國中力學概念" required /></label>
    <label>課程起始時間<input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required /></label>
    <label>課程結束時間<input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required /></label>
    <div className="subtle" style={{ fontSize: 13 }}>課程期間以台灣時間（UTC+8）判定，學生的學習活動天數只會在此期間內累計。</div>
    {error && <div className="error">{error}</div>}
    <button className="btn btn-primary" disabled={!semesters.length}>建立課程</button>
  </form>;
}
