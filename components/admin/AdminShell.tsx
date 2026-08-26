"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/auth/LogoutButton";
import Brand from "@/components/Brand";

const navItems = [
  { href: "/admin", label: "儀表板", exact: true },
  { href: "/admin/semesters", label: "學期管理" },
  { href: "/admin/courses", label: "課程管理" },
  { href: "/admin/students", label: "學生管理" },
  { href: "/admin/assets", label: "PDF資產庫" },
  { href: "/admin/submissions", label: "閱讀/繳交紀錄" },
  { href: "/admin/highlights", label: "課程劃記總覽" },
  { href: "/admin/settings", label: "系統設定" },
];

export default function AdminShell({ username, children }: { username: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);


  return <div className="shell">
    <header className="topbar">
      <div className="container admin-topbar">
        <div className="admin-brand-area">
          <button
            type="button"
            className="admin-menu-button"
            aria-label="開啟管理選單"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <span /><span /><span />
          </button>
          <Brand href="/admin" />
        </div>
        <div className="row admin-account-area">
          <span className="subtle">管理端：{username}</span>
          <LogoutButton />
        </div>
      </div>
    </header>

    {menuOpen && <button type="button" className="sidebar-backdrop" aria-label="關閉管理選單" onClick={() => setMenuOpen(false)} />}

    <div className="admin-grid">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-mobile-head">
          <strong>管理功能</strong>
          <button type="button" className="sidebar-close" aria-label="關閉管理選單" onClick={() => setMenuOpen(false)}>×</button>
        </div>
        <nav>
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} className={active ? "active" : undefined} onClick={() => setMenuOpen(false)}>{item.label}</Link>;
          })}
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  </div>;
}
