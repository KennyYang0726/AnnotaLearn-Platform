"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { getPdfPageCount } from "@/lib/pdf-client";

const storageMode = process.env.NEXT_PUBLIC_STORAGE_DRIVER === "blob" ? "blob" : "local";

export default function AssetUploadForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return setError("僅允許PDF檔案");
    setLoading(true); setError(""); setProgress(0);
    try {
      const pageCount = await getPdfPageCount(file);
      if (storageMode === "blob") {
        const pathname = `assets/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const blob = await upload(pathname, file, {
          access: "private",
          handleUploadUrl: "/api/admin/assets/blob-upload",
          multipart: file.size > 100 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
        });
        const finalize = await fetch("/api/admin/assets/blob-finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalName: file.name,
            displayName: displayName.trim() || file.name.replace(/\.pdf$/i, ""),
            pathname: blob.pathname,
            url: blob.url,
            fileSize: file.size,
            pageCount,
          }),
        });
        const result = await finalize.json();
        if (!finalize.ok) throw new Error(result.error || "資產登錄失敗");
      } else {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("displayName", displayName.trim() || file.name.replace(/\.pdf$/i, ""));
        formData.append("pageCount", String(pageCount));
        const response = await fetch("/api/admin/assets/local-upload", { method: "POST", body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "上傳失敗");
        setProgress(100);
      }
      setFile(null); setDisplayName(""); router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "上傳失敗");
    } finally { setLoading(false); }
  }

  return <form className="stack" onSubmit={submit}>
    <label>PDF檔案<input type="file" accept="application/pdf,.pdf" onChange={(e) => { const f=e.target.files?.[0]||null; setFile(f); if (f && !displayName) setDisplayName(f.name.replace(/\.pdf$/i, "")); }} required /></label>
    <label>教材顯示名稱<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="例如：第一章 牛頓運動定律" /></label>
    {loading && <div className="subtle">處理中…{progress > 0 ? ` ${progress}%` : ""}</div>}
    {error && <div className="error">{error}</div>}
    <button className="btn btn-primary" disabled={!file || loading}>{loading ? "上傳中…" : "上傳PDF"}</button>
  </form>;
}
