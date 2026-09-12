"use client";

import { useState } from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export default function PasswordInput(props: Props) {
  const [visible, setVisible] = useState(false);
  return <div className="password-input-wrap">
    <input {...props} type={visible ? "text" : "password"} />
    <button
      className="password-visibility-button"
      type="button"
      aria-label={visible ? "隱藏密碼" : "顯示密碼"}
      title={visible ? "隱藏密碼" : "顯示密碼"}
      aria-pressed={visible}
      onClick={() => setVisible((value) => !value)}
    >
      {visible ? (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A10.7 10.7 0 0112 4c5.5 0 9 5.5 9 5.5a15.5 15.5 0 01-3.1 3.7M6.2 6.2C4.1 7.5 3 9.5 3 9.5S6.5 15 12 15c1 0 2-.2 2.9-.5" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-5.5 9-5.5S21 12 21 12s-3.5 5.5-9 5.5S3 12 3 12z" /><circle cx="12" cy="12" r="2.5" /></svg>
      )}
    </button>
  </div>;
}
