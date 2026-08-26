"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  endpoint: string;
  title: string;
  subject: string;
  detail?: string;
  impact?: string;
  dangerMessage?: string;
  buttonLabel?: string;
};

export default function DeleteAdminEntityButton({
  endpoint,
  title,
  subject,
  detail,
  impact,
  dangerMessage,
  buttonLabel = "刪除",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function close() {
    if (loading) return;
    setOpen(false);
    setStep(1);
    setError("");
  }

  async function remove() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "刪除失敗");
      setOpen(false);
      setStep(1);
      router.refresh();
      if (data.warning) window.alert(data.warning);
    } catch (error) {
      setError(error instanceof Error ? error.message : "刪除失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="btn btn-danger btn-compact btn-nowrap" type="button" onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
      {open && (
        <div className="modal-backdrop" role="presentation" onMouseDown={close}>
          <section className="card modal admin-delete-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="danger-icon" aria-hidden="true">!</div>
            {step === 1 ? (
              <>
                <h2 className="h2">{title}</h2>
                <p>即將刪除<strong>{subject}</strong>。</p>
                {detail && <p className="subtle delete-warning">{detail}</p>}
                {impact && <div className="delete-impact-note">{impact}</div>}
                {dangerMessage && <div className="asset-in-use-warning">{dangerMessage}</div>}
                {error && <div className="error">{error}</div>}
                <div className="row delete-actions">
                  <button className="btn btn-outline" type="button" onClick={close}>取消</button>
                  <button className="btn btn-danger" type="button" onClick={() => setStep(2)}>繼續</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="h2">再次確認刪除</h2>
                <p>此操作完成後無法復原。</p>
                <p><strong>{subject}</strong></p>
                {dangerMessage && <div className="asset-in-use-warning">{dangerMessage}</div>}
                {error && <div className="error">{error}</div>}
                <div className="row delete-actions">
                  <button className="btn btn-outline" type="button" onClick={() => { setStep(1); setError(""); }} disabled={loading}>返回</button>
                  <button className="btn btn-danger" type="button" onClick={remove} disabled={loading}>{loading ? "刪除中…" : "確認刪除"}</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
