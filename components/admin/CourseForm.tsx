"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CourseForm({ semesters }: { semesters: { id: string; code: string }[] }) {
  const router = useRouter();
  const [semesterId, setSemesterId] = useState(semesters[0]?.id || "");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    const response = await fetch("/api/admin/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ semesterId, name }) });
    const data = await response.json(); if (!response.ok) return setError(data.error || "建立失敗");
    setName(""); router.refresh();
  }
  return <form className="stack" onSubmit={submit}>
    <label>學期<select value={semesterId} onChange={(e) => setSemesterId(e.target.value)} required>{semesters.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}</select></label>
    <label>課程名稱<input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：國中力學概念" required /></label>
    {error && <div className="error">{error}</div>}
    <button className="btn btn-primary" disabled={!semesters.length}>建立課程</button>
  </form>;
}
