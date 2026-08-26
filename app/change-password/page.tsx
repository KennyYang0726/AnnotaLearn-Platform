import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import ChangePasswordForm from "@/components/auth/ChangePasswordForm";
import Brand from "@/components/Brand";

export default async function ChangePasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.mustChangePassword) redirect(session.role === "ADMIN" ? "/admin" : "/courses");
  return <main className="center-page">
    <section className="card auth-card stack">
      <div><Brand href="/change-password" /><h1 className="h1" style={{ marginTop: 18 }}>首次登入：變更密碼</h1></div>
      <ChangePasswordForm />
    </section>
  </main>;
}
