import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth/api";

export async function DELETE(_request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { courseId } = await params;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true },
  });
  if (!course) return NextResponse.json({ error: "找不到指定課程" }, { status: 404 });

  try {
    await prisma.course.delete({ where: { id: courseId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "刪除課程失敗" }, { status: 500 });
  }
}
