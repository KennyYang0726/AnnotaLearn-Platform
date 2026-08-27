"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  studentId: string;
  username: string;
  displayName?: string | null;
};

export default function ResetStudentPasswordButton({ studentId, username, displayName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [defaultPassword, setDefaultPassword] = useState("");

  function close() {
    if (loading) return;
    setOpen(false);
    setError("");
    setDefaultPassword("");
  }

  async function resetPassword() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/students/${studentId}/reset-password`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "重設密碼失敗");
      setDefaultPassword(data.defaultPassword || "");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "重設密碼失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="btn btn-outline btn-compact btn-nowrap" type="button" onClick={() => setOpen(true)}>
        重設密碼
      </button>
      {open && (
        <div className="modal-backdrop" role="presentation" onMouseDown={close}>
          <section className="card modal delete-student-modal" role="dialog" aria-modal="true" aria-labelledby={`reset-password-${studentId}`} onMouseDown={(event) => event.stopPropagation()}>
            <h2 className="h2" id={`reset-password-${studentId}`}>重設學生密碼</h2>
            {defaultPassword ? (
              <>
                <p><strong>{username}</strong>{displayName ? `（${displayName}）` : ""}的密碼已重設。</p>
                <div className="delete-impact">
                  <div style={{ width: "100%" }}>
                    <span>預設密碼</span>
                    <strong style={{ fontSize: 16, wordBreak: "break-all" }}>{defaultPassword}</strong>
                  </div>
                </div>
                <p className="subtle">學生下次使用此密碼登入後，系統會要求重新設定密碼。</p>
                <div className="row delete-actions">
                  <button className="btn btn-primary" type="button" onClick={close}>完成</button>
                </div>
              </>
            ) : (
              <>
                <p>
                  確定要將<strong>{username}</strong>{displayName ? `（${displayName}）` : ""}的密碼重設為系統預設值嗎？
                </p>
                <p className="subtle">預設密碼為大寫學號重複2遍後加上「!」。重設後，學生再次登入時必須變更密碼。</p>
                {error && <div className="error">{error}</div>}
                <div className="row delete-actions">
                  <button className="btn btn-outline" type="button" onClick={close} disabled={loading}>取消</button>
                  <button className="btn btn-primary" type="button" onClick={resetPassword} disabled={loading}>{loading ? "重設中…" : "確認重設密碼"}</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
