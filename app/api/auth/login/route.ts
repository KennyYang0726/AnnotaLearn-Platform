import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";

const schema = z.object({ username: z.string().trim().min(1).max(80), password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "帳號或密碼格式錯誤" }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { username: { equals: parsed.data.username, mode: "insensitive" } },
  });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "帳號或密碼錯誤" }, { status: 401 });
  }

  await createSession({ id: user.id, username: user.username, role: user.role, mustChangePassword: user.mustChangePassword });
  const redirectTo = user.mustChangePassword ? "/change-password" : user.role === "ADMIN" ? "/admin" : "/courses";
  return NextResponse.json({ ok: true, redirectTo });
}
