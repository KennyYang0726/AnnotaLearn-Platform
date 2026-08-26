"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) return setError("兩次輸入的新密碼不一致");
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "變更密碼失敗");
      router.replace(data.redirectTo);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "變更密碼失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>目前密碼<input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></label>
      <label>新密碼<input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required /></label>
      <label>再次輸入新密碼<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required /></label>
      <div className="subtle">新密碼至少8個字元。首次登入學生帳號必須完成此步驟。</div>
      {error && <div className="error">{error}</div>}
      <button className="btn btn-primary" disabled={loading}>{loading ? "儲存中…" : "更新密碼"}</button>
    </form>
  );
}
