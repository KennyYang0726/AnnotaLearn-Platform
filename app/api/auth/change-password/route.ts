import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, getSession } from "@/lib/auth/session";

const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(200) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "尚未登入" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "新密碼至少需要8個字元" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "目前密碼不正確" }, { status: 400 });
  }
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  const updated = await prisma.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });
  await createSession({ id: updated.id, username: updated.username, role: updated.role, mustChangePassword: false });
  return NextResponse.json({ ok: true, redirectTo: updated.role === "ADMIN" ? "/admin" : "/courses" });
}
