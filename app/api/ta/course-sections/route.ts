import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiCourseManager } from "@/lib/auth/course-access";

const createSchema = z.object({ courseId: z.string().min(1), title: z.string().trim().min(1).max(120), description: z.string().trim().max(500).optional().default("") });
const updateSchema = z.object({ courseId: z.string().min(1), sectionId: z.string().min(1), title: z.string().trim().min(1).max(120).optional(), description: z.string().trim().max(500).optional(), direction: z.enum(["UP", "DOWN"]).optional() });
const deleteSchema = z.object({ courseId: z.string().min(1), sectionId: z.string().min(1) });

async function authorize(courseId: string) {
  const auth = await requireApiCourseManager(courseId);
  if (!auth.ok) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  if (auth.user.role !== "TA") return { response: NextResponse.json({ error: "此端點僅供助教課程工作區使用" }, { status: 403 }) };
  return { auth };
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "單元欄位格式錯誤" }, { status: 400 });
  const authorization = await authorize(parsed.data.courseId); if ("response" in authorization) return authorization.response;
  const aggregate = await prisma.courseSection.aggregate({ where: { courseId: parsed.data.courseId }, _max: { sortOrder: true } });
  await prisma.courseSection.create({ data: { courseId: parsed.data.courseId, title: parsed.data.title, description: parsed.data.description || null, sortOrder: (aggregate._max.sortOrder ?? -1) + 1 } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "單元更新格式錯誤" }, { status: 400 });
  const authorization = await authorize(parsed.data.courseId); if ("response" in authorization) return authorization.response;
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
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "單元刪除格式錯誤" }, { status: 400 });
  const authorization = await authorize(parsed.data.courseId); if ("response" in authorization) return authorization.response;
  const section = await prisma.courseSection.findFirst({ where: { id: parsed.data.sectionId, courseId: parsed.data.courseId }, select: { id: true } });
  if (!section) return NextResponse.json({ ok: true });
  await prisma.courseSection.delete({ where: { id: section.id } });
  return NextResponse.json({ ok: true });
}
