"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SemesterForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    const response = await fetch("/api/admin/semesters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const data = await response.json();
    if (!response.ok) return setError(data.error || "新增失敗");
    setCode(""); setMessage("學期已新增"); router.refresh();
  }

  return <form className="stack" onSubmit={submit}>
    <label>學期代碼<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="例如：115-1" required /></label>
    {error && <div className="error">{error}</div>}{message && <div className="success">{message}</div>}
    <button className="btn btn-primary">新增學期</button>
  </form>;
}
