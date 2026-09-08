"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Brand from "@/components/Brand";
import LogoutButton from "@/components/auth/LogoutButton";

export default function TaShell({ username, children }: { username: string; children: React.ReactNode }) {
  const pathname = usePathname();
  return <div className="shell ta-shell">
    <header className="topbar ta-topbar">
      <div className="container ta-topbar-inner">
        <div className="ta-brand-area"><Brand href="/ta" /><span className="badge">助教端</span></div>
        <div className="row ta-account-area"><Link className={`btn btn-outline btn-compact ${pathname === "/ta" ? "ta-nav-active" : ""}`} href="/ta">我的協作課程</Link><span className="subtle">{username}</span><LogoutButton /></div>
      </div>
    </header>
    <main className="container ta-main">{children}</main>
  </div>;
}
