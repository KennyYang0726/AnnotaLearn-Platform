import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth/api";
import { defaultStudentPassword } from "@/lib/password";
import { normalizeStudentId } from "@/lib/student-account";

export async function POST(_request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { studentId } = await params;
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { id: true, username: true, role: true },
  });

  if (!student || student.role !== "STUDENT") {
    return NextResponse.json({ error: "找不到指定學生" }, { status: 404 });
  }

  const username = normalizeStudentId(student.username);
  const defaultPassword = defaultStudentPassword(username);
  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  await prisma.user.update({
    where: { id: student.id },
    data: {
      username,
      passwordHash,
      mustChangePassword: true,
    },
  });

  return NextResponse.json({ ok: true, username, defaultPassword });
}
