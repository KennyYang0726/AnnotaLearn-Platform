"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CourseDownloadSetting({ courseId, initialEnabled }: { courseId: string; initialEnabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    const next = !enabled;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/admin/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowMaterialDownload: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "更新下載設定失敗");
      setEnabled(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新下載設定失敗");
    } finally {
      setSaving(false);
    }
  }

  return <div className="course-setting-row">
    <div>
      <strong>教材下載</strong>
      <div className="subtle">學生是否可下載此課程的原始PDF教材。</div>
    </div>
    <div className="row">
      <span className={`badge ${enabled ? "setting-on" : ""}`}>{enabled ? "已開放" : "已關閉"}</span>
      <button type="button" className={`btn ${enabled ? "btn-danger" : "btn-primary"}`} onClick={toggle} disabled={saving}>{saving ? "更新中…" : enabled ? "關閉下載" : "開放下載"}</button>
    </div>
    {error && <div className="error course-setting-error">{error}</div>}
  </div>;
}
