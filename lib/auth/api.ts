import "server-only";
import { getSession } from "./session";

export async function requireApiUser() {
  const session = await getSession();
  if (!session) return { ok: false as const, status: 401, error: "尚未登入" };
  if (session.mustChangePassword) return { ok: false as const, status: 403, error: "請先變更初始密碼" };
  return { ok: true as const, user: session };
}

export async function requireApiAdmin() {
  const result = await requireApiUser();
  if (!result.ok) return result;
  if (result.user.role !== "ADMIN") return { ok: false as const, status: 403, error: "沒有管理權限" };
  return result;
}
