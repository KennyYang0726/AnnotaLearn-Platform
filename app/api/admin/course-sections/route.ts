import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth/api";

const createSchema = z.object({
  courseId: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().default(""),
});

const updateSchema = z.object({
  courseId: z.string().min(1),
  sectionId: z.string().min(1),
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  direction: z.enum(["UP", "DOWN"]).optional(),
});

const deleteSchema = z.object({ courseId: z.string().min(1), sectionId: z.string().min(1) });

async function requireAdmin() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return null;
}

export async function POST(request: Request) {
  const authResponse = await requireAdmin(); if (authResponse) return authResponse;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "單元欄位格式錯誤" }, { status: 400 });
  const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId }, select: { id: true } });
  if (!course) return NextResponse.json({ error: "找不到課程" }, { status: 404 });
  const aggregate = await prisma.courseSection.aggregate({ where: { courseId: course.id }, _max: { sortOrder: true } });
  await prisma.courseSection.create({ data: { courseId: course.id, title: parsed.data.title, description: parsed.data.description || null, sortOrder: (aggregate._max.sortOrder ?? -1) + 1 } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const authResponse = await requireAdmin(); if (authResponse) return authResponse;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "單元更新格式錯誤" }, { status: 400 });
  const section = await prisma.courseSection.findFirst({ where: { id: parsed.data.sectionId, courseId: parsed.data.courseId }, select: { id: true } });
  if (!section) return NextResponse.json({ error: "找不到指定單元" }, { status: 404 });

  if (parsed.data.direction) {
    const sections = await prisma.courseSection.findMany({ where: { courseId: parsed.data.courseId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
    const currentIndex = sections.findIndex((item) => item.id === section.id);
    const targetIndex = parsed.data.direction === "UP" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return NextResponse.json({ ok: true });
    const reordered = [...sections];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
    await prisma.$transaction(reordered.map((item, index) => prisma.courseSection.update({ where: { id: item.id }, data: { sortOrder: index } })));
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.title === undefined && parsed.data.description === undefined) return NextResponse.json({ error: "沒有可更新的單元欄位" }, { status: 400 });
  await prisma.courseSection.update({ where: { id: section.id }, data: { ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}), ...(parsed.data.description !== undefined ? { description: parsed.data.description || null } : {}) } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const authResponse = await requireAdmin(); if (authResponse) return authResponse;
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "單元刪除格式錯誤" }, { status: 400 });
  const section = await prisma.courseSection.findFirst({ where: { id: parsed.data.sectionId, courseId: parsed.data.courseId }, select: { id: true } });
  if (!section) return NextResponse.json({ ok: true });
  await prisma.courseSection.delete({ where: { id: section.id } });
  return NextResponse.json({ ok: true });
}
