"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "登入失敗");
      router.replace(data.redirectTo);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "登入失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>
        帳號/學號
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
      </label>
      <label>
        密碼
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        <span className="subtle" style={{ fontSize: 13, fontWeight: 400 }}>初始密碼為學號大寫2遍+!</span>
      </label>
      {error && <div className="error">{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={loading}>
        {loading ? "登入中…" : "登入"}
      </button>
    </form>
  );
}
