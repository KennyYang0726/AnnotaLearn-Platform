"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getPdfPageCount } from "@/lib/pdf-client";

export default function AssetUploadForm({ apiBase = "/api/admin/assets", afterUploadMessage }: { apiBase?: string; afterUploadMessage?: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return setError("僅允許PDF檔案");
    setLoading(true); setError(""); setSuccess(""); setProgress(0);
    try {
      const pageCount = await getPdfPageCount(file);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("displayName", displayName.trim() || file.name.replace(/\.pdf$/i, ""));
      formData.append("pageCount", String(pageCount));
      const response = await fetch(`${apiBase}/local-upload`, { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "上傳失敗");
      setProgress(100);
      setFile(null); setDisplayName(""); setSuccess(afterUploadMessage || "PDF已加入共用資產庫。"); router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "上傳失敗");
    } finally { setLoading(false); }
  }

  return <form className="stack" onSubmit={submit}>
    <label>PDF檔案<input type="file" accept="application/pdf,.pdf" onChange={(e) => { const f=e.target.files?.[0]||null; setFile(f); if (f && !displayName) setDisplayName(f.name.replace(/\.pdf$/i, "")); }} required /></label>
    <label>教材顯示名稱<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="例如：第一章 牛頓運動定律" /></label>
    {loading && <div className="subtle">處理中…{progress > 0 ? ` ${progress}%` : ""}</div>}
    {error && <div className="error">{error}</div>}
    {success && <div className="success">{success}</div>}
    <button className="btn btn-primary" disabled={!file || loading}>{loading ? "上傳中…" : "上傳PDF"}</button>
  </form>;
}
