"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CONFIRM_TEXT = "確定清除";
const WAIT_SECONDS = 10;

export default function SystemResetPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [seconds, setSeconds] = useState(WAIT_SECONDS);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSeconds(WAIT_SECONDS);
    setConfirmation("");
    setError("");
    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  const canReset = seconds === 0 && confirmation === CONFIRM_TEXT && !loading;

  async function resetSystem() {
    if (!canReset) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/system/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "清除資料失敗");
      setOpen(false);
      router.replace("/admin");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "清除資料失敗");
    } finally {
      setLoading(false);
    }
  }

  return <>
    <button className="btn btn-danger btn-nowrap" type="button" onClick={() => setOpen(true)}>清除全部資料</button>
    {open && <div className="modal-backdrop" role="presentation" onMouseDown={() => !loading && setOpen(false)}>
      <section className="card modal delete-student-modal" role="dialog" aria-modal="true" aria-labelledby="system-reset-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="danger-icon" aria-hidden="true">!</div>
        <h2 className="h2" id="system-reset-title">確認清除全部資料</h2>
        <p>此操作無法復原。管理端帳號會保留，其餘教學資料與已登錄PDF檔案將永久刪除。</p>
        <label>
          請輸入「{CONFIRM_TEXT}」
          <input className="reset-confirm-input" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
        </label>
        <div className="reset-countdown">{seconds > 0 ? `安全等待：${seconds}秒` : "安全等待完成"}</div>
        {error && <div className="error">{error}</div>}
        <div className="row delete-actions">
          <button className="btn btn-outline" type="button" onClick={() => setOpen(false)} disabled={loading}>取消</button>
          <button className="btn btn-danger" type="button" onClick={resetSystem} disabled={!canReset}>{loading ? "清除中…" : "確認清除全部資料"}</button>
        </div>
      </section>
    </div>}
  </>;
}
