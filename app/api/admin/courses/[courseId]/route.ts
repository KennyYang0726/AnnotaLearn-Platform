import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth/api";

const updateSchema = z.object({ allowMaterialDownload: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "課程設定格式錯誤" }, { status: 400 });
  const { courseId } = await params;
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
  if (!course) return NextResponse.json({ error: "找不到指定課程" }, { status: 404 });
  await prisma.course.update({ where: { id: courseId }, data: { allowMaterialDownload: parsed.data.allowMaterialDownload } });
  return NextResponse.json({ ok: true, allowMaterialDownload: parsed.data.allowMaterialDownload });
}

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
