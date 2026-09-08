import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import LoginForm from "@/components/auth/LoginForm";
import Brand from "@/components/Brand";
import { homeForRole } from "@/lib/auth/role-home";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.mustChangePassword ? "/change-password" : homeForRole(session.role));

  return <main className="center-page">
    <section className="card auth-card stack">
      <div>
        <Brand href="/login" />
        <h1 className="h1" style={{ marginTop: 18 }}>登入</h1>
        <p className="subtle">教材閱讀、重點標記與盲點提問平台</p>
      </div>
      <LoginForm />
    </section>
  </main>;
}
