import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth/api";
import { defaultStudentPassword } from "@/lib/password";
import { normalizeStudentId } from "@/lib/student-account";

const schema = z.object({ studentId: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/, "學號只能使用英文字母、數字、底線與連字號") });

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "學號格式錯誤" }, { status: 400 });

  const username = normalizeStudentId(parsed.data.studentId);
  const existing = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: "此學號已存在" }, { status: 409 });

  const defaultPassword = defaultStudentPassword(username);
  const passwordHash = await bcrypt.hash(defaultPassword, 12);
  const user = await prisma.user.create({
    data: { username, passwordHash, role: "STUDENT", mustChangePassword: true },
    select: { id: true, username: true },
  });

  return NextResponse.json({ userId: user.id, username: user.username, defaultPassword });
}
