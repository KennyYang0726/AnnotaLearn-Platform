import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./session";
import { homeForRole } from "./role-home";

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/change-password");
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.role !== "ADMIN") redirect(homeForRole(session.role));
  return session;
}

export async function requireTa() {
  const session = await requireUser();
  if (session.role !== "TA") redirect(session.role === "ADMIN" ? "/admin" : "/courses");
  return session;
}

export async function requireStudent() {
  const session = await requireUser();
  if (session.role !== "STUDENT") redirect(session.role === "ADMIN" ? "/admin" : "/ta");
  return session;
}
