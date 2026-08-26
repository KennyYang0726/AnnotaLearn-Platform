import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth/api";

export async function DELETE(_request: Request, { params }: { params: Promise<{ semesterId: string }> }) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { semesterId } = await params;
  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
    include: { _count: { select: { courses: true } } },
  });
  if (!semester) return NextResponse.json({ error: "找不到指定學期" }, { status: 404 });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.course.deleteMany({ where: { semesterId } });
      await tx.semester.delete({ where: { id: semesterId } });
    });
    return NextResponse.json({ ok: true, deletedCourses: semester._count.courses });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "刪除學期失敗" }, { status: 500 });
  }
}
