import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./session";

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/change-password");
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.role !== "ADMIN") redirect("/courses");
  return session;
}

export async function requireStudent() {
  const session = await requireUser();
  if (session.role !== "STUDENT") redirect("/admin");
  return session;
}
