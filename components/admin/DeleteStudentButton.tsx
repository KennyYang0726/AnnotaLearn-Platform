"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  studentId: string;
  username: string;
  displayName?: string | null;
  enrollmentCount: number;
  submissionCount: number;
};

export default function DeleteStudentButton({
  studentId,
  username,
  displayName,
  enrollmentCount,
  submissionCount,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function removeStudent() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/students/${studentId}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "刪除學生失敗");
      setOpen(false);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "刪除學生失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="btn btn-danger btn-compact btn-nowrap" type="button" onClick={() => setOpen(true)}>
        刪除
      </button>
      {open && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !loading && setOpen(false)}>
          <section className="card modal delete-student-modal" role="dialog" aria-modal="true" aria-labelledby={`delete-student-${studentId}`} onMouseDown={(event) => event.stopPropagation()}>
            <div className="danger-icon" aria-hidden="true">!</div>
            <h2 className="h2" id={`delete-student-${studentId}`}>刪除學生帳號？</h2>
            <p>
              即將永久刪除<strong>{username}</strong>{displayName ? `（${displayName}）` : ""}。
            </p>
            <div className="delete-impact">
              <div><strong>{enrollmentCount}</strong><span>筆課程分配</span></div>
              <div><strong>{submissionCount}</strong><span>筆教材繳交</span></div>
            </div>
            <p className="subtle delete-warning">其繳交內容、筆記與螢光筆劃記也會一併刪除，且無法復原。</p>
            {error && <div className="error">{error}</div>}
            <div className="row delete-actions">
              <button className="btn btn-outline" type="button" onClick={() => setOpen(false)} disabled={loading}>取消</button>
              <button className="btn btn-danger" type="button" onClick={removeStudent} disabled={loading}>{loading ? "刪除中…" : "確認永久刪除"}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
