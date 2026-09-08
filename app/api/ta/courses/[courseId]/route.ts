import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiCourseManager } from "@/lib/auth/course-access";

const schema = z.object({ allowMaterialDownload: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const auth = await requireApiCourseManager(courseId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "TA") return NextResponse.json({ error: "此端點僅供助教課程工作區使用" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "課程設定格式錯誤" }, { status: 400 });
  await prisma.course.update({ where: { id: courseId }, data: { allowMaterialDownload: parsed.data.allowMaterialDownload } });
  return NextResponse.json({ ok: true });
}
