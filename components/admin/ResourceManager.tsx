"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Asset = { id: string; displayName: string; originalName: string; assigned: boolean };
export default function ResourceManager({ courseId, assets }: { courseId: string; assets: Asset[] }) {
  const router = useRouter(); const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState("");
  async function toggle(asset: Asset) {
    setBusy(asset.id); setError("");
    const response = await fetch("/api/admin/course-resources", { method: asset.assigned ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, assetId: asset.id, title: asset.displayName }) });
    const data = await response.json(); if (!response.ok) setError(data.error || "操作失敗"); else router.refresh(); setBusy(null);
  }
  return <div className="stack">{error && <div className="error">{error}</div>}<div className="table-wrap"><table><thead><tr><th>教材</th><th>狀態</th><th></th></tr></thead><tbody>{assets.map((a) => <tr key={a.id}><td><strong>{a.displayName}</strong><div className="subtle">{a.originalName}</div></td><td>{a.assigned ? <span className="badge">已加入課程</span> : "資產庫"}</td><td><button className={`btn ${a.assigned ? "btn-danger" : "btn-primary"}`} disabled={busy === a.id} onClick={() => toggle(a)}>{a.assigned ? "移除教材" : "加入教材"}</button></td></tr>)}</tbody></table></div></div>;
}
