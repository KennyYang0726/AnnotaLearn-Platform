import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth/api";

export async function DELETE(_request: Request, { params }: { params: Promise<{ studentId: string }> }) {
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

  await prisma.user.delete({ where: { id: student.id } });
  return NextResponse.json({ ok: true, username: student.username });
}
