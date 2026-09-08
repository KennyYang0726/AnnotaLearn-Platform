import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/role-home";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/change-password");
  redirect(homeForRole(session.role));
}
