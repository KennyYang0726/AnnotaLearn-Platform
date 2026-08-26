import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth/api";

const singleSchema = z.object({ courseId: z.string().min(1), userId: z.string().min(1) });
const batchSchema = z.object({ courseId: z.string().min(1), userIds: z.array(z.string().min(1)).min(1).max(500) });

async function authorize() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return null;
}

export async function POST(request: Request) {
  const denied = await authorize(); if (denied) return denied;
  const raw = await request.json().catch(() => null);
  const batch = batchSchema.safeParse(raw);
  if (batch.success) {
    const uniqueIds = Array.from(new Set(batch.data.userIds));
    const [course, students, existing] = await Promise.all([
      prisma.course.findUnique({ where: { id: batch.data.courseId }, select: { id: true } }),
      prisma.user.findMany({ where: { id: { in: uniqueIds }, role: "STUDENT" }, select: { id: true } }),
      prisma.enrollment.findMany({ where: { courseId: batch.data.courseId, userId: { in: uniqueIds } }, select: { userId: true } }),
    ]);
    if (!course) return NextResponse.json({ error: "找不到課程" }, { status: 404 });
    const validIds = students.map((student) => student.id);
    if (!validIds.length) return NextResponse.json({ error: "這份名單沒有可加入的學生" }, { status: 400 });
    const existingIds = new Set(existing.map((item) => item.userId));
    const toCreate = validIds.filter((id) => !existingIds.has(id));
    if (toCreate.length) await prisma.enrollment.createMany({ data: toCreate.map((userId) => ({ userId, courseId: batch.data.courseId })), skipDuplicates: true });
    return NextResponse.json({ ok: true, addedCount: toCreate.length, alreadyEnrolledCount: validIds.length - toCreate.length, ignoredCount: uniqueIds.length - validIds.length });
  }

  const single = singleSchema.safeParse(raw);
  if (!single.success) return NextResponse.json({ error: "欄位格式錯誤" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: single.data.userId } });
  if (!user || user.role !== "STUDENT") return NextResponse.json({ error: "找不到學生" }, { status: 404 });
  await prisma.enrollment.upsert({ where: { userId_courseId: single.data }, update: {}, create: single.data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const denied = await authorize(); if (denied) return denied;
  const parsed = singleSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "欄位格式錯誤" }, { status: 400 });
  await prisma.enrollment.deleteMany({ where: parsed.data });
  return NextResponse.json({ ok: true });
}
