"use client";

import { useState } from "react";
import PasswordInput from "@/components/auth/PasswordInput";
import { useRouter } from "next/navigation";

type Course = { id: string; label: string };
type Assistant = {
  id: string;
  username: string;
  displayName?: string | null;
  mustChangePassword: boolean;
  assignedCourseIds: string[];
  uploadedAssetCount: number;
};

export default function AssistantManager({ courses, assistants }: { courses: Course[]; assistants: Assistant[] }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Assistant | null>(null);

  async function createAssistant(event: React.FormEvent) {
    event.preventDefault();
    setBusy("create"); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/admin/assistants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName, initialPassword, courseIds }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "建立助教失敗");
      setSuccess(`已建立助教 ${data.assistant.username}，首次登入會要求變更密碼。`);
      setUsername(""); setDisplayName(""); setInitialPassword(""); setCourseIds([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "建立助教失敗");
    } finally { setBusy(""); }
  }

  async function toggleAssignment(assistantId: string, courseId: string, assigned: boolean) {
    const key = `${assistantId}:${courseId}`;
    setBusy(key); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/admin/course-staff", {
        method: assigned ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: assistantId, courseId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "更新課程分配失敗");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新課程分配失敗");
    } finally { setBusy(""); }
  }

  async function removeAssistant() {
    if (!deleteTarget) return;
    setBusy(`delete:${deleteTarget.id}`); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/admin/assistants/${deleteTarget.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "刪除助教失敗");
      setDeleteTarget(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "刪除助教失敗");
    } finally { setBusy(""); }
  }

  return <div className="stack">
    <section className="card panel stack" style={{ maxWidth: 820 }}>
      <div>
        <h2 className="h2">建立助教帳號</h2>
        <div className="subtle">助教只能進入被分配的課程工作區，不會取得全站管理後台權限。</div>
      </div>
      <form className="stack" onSubmit={createAssistant}>
        <div className="grid-2">
          <label>登入帳號<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="例如：ta01" required /></label>
          <label>顯示名稱（選填）<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="例如：王小明助教" /></label>
        </div>
        <label>初始密碼<PasswordInput minLength={8} value={initialPassword} onChange={(e) => setInitialPassword(e.target.value)} autoComplete="new-password" required /><span className="subtle">至少8個字元，首次登入後必須自行變更。</span></label>
        {courses.length > 0 && <fieldset className="assistant-course-picker">
          <legend>建立後先分配到哪些課程（選填）</legend>
          <div className="assistant-course-options">{courses.map((course) => <label className="assistant-course-check" key={course.id}>
            <input type="checkbox" checked={courseIds.includes(course.id)} onChange={(e) => setCourseIds((current) => e.target.checked ? [...current, course.id] : current.filter((id) => id !== course.id))} />
            <span>{course.label}</span>
          </label>)}</div>
        </fieldset>}
        <button className="btn btn-primary" disabled={busy === "create"}>{busy === "create" ? "建立中…" : "建立助教"}</button>
      </form>
      {success && <div className="success">{success}</div>}
      {error && <div className="error">{error}</div>}
    </section>

    <section className="card panel stack">
      <div><h2 className="h2">助教與課程分配</h2><div className="subtle">勾選即授權該助教管理該門課，取消勾選會立即撤銷課程工作區權限。</div></div>
      {assistants.length === 0 ? <div className="empty-state subtle">目前尚未建立助教帳號。</div> : <div className="assistant-list">
        {assistants.map((assistant) => {
          const assigned = new Set(assistant.assignedCourseIds);
          return <article className="assistant-card" key={assistant.id}>
            <div className="assistant-card-head">
              <div><strong>{assistant.displayName || assistant.username}</strong><div className="subtle">{assistant.username} · {assistant.mustChangePassword ? "尚未變更初始密碼" : "密碼已啟用"}</div></div>
              <button className="btn btn-danger btn-compact" type="button" onClick={() => setDeleteTarget(assistant)}>刪除助教</button>
            </div>
            <div className="subtle">自行上傳資產：{assistant.uploadedAssetCount}份。刪除助教帳號時，已上傳的PDF資產會保留在共用資產庫。</div>
            <div className="assistant-assignment-grid">{courses.map((course) => {
              const checked = assigned.has(course.id);
              const key = `${assistant.id}:${course.id}`;
              return <label className={`assistant-assignment-item ${checked ? "is-assigned" : ""}`} key={course.id}>
                <input type="checkbox" checked={checked} disabled={busy === key} onChange={() => toggleAssignment(assistant.id, course.id, checked)} />
                <span>{course.label}</span>
              </label>;
            })}</div>
          </article>;
        })}
      </div>}
    </section>

    {deleteTarget && <div className="modal-backdrop" role="presentation" onMouseDown={() => !busy.startsWith("delete:") && setDeleteTarget(null)}>
      <section className="card modal admin-delete-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="danger-icon" aria-hidden="true">!</div>
        <h2 className="h2">刪除助教帳號？</h2>
        <p>即將刪除<strong>{deleteTarget.displayName || deleteTarget.username}</strong>（{deleteTarget.username}）。</p>
        <div className="delete-impact-note">課程授權會一併移除，此助教已上傳的{deleteTarget.uploadedAssetCount}份PDF仍會保留在共用資產庫，不會因帳號刪除而消失。</div>
        <div className="row delete-actions"><button className="btn btn-outline" type="button" onClick={() => setDeleteTarget(null)} disabled={busy.startsWith("delete:")}>取消</button><button className="btn btn-danger" type="button" onClick={removeAssistant} disabled={busy.startsWith("delete:")}>{busy.startsWith("delete:") ? "刪除中…" : "確認刪除"}</button></div>
      </section>
    </div>}
  </div>;
}
