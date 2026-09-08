import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiCourseManager } from "@/lib/auth/course-access";

const assignmentSchema = z.object({ courseId: z.string().min(1), assetId: z.string().min(1), title: z.string().trim().min(1).max(180), confirmDataLoss: z.boolean().optional().default(false) });
const reorderSchema = z.object({ courseId: z.string().min(1), resourceId: z.string().min(1), direction: z.enum(["UP", "DOWN"]) });

async function authorize(courseId: string) {
  const auth = await requireApiCourseManager(courseId);
  if (!auth.ok) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  if (auth.user.role !== "TA") return { response: NextResponse.json({ error: "此端點僅供助教課程工作區使用" }, { status: 403 }) };
  return { auth };
}

export async function POST(request: Request) {
  const parsed = assignmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "欄位格式錯誤" }, { status: 400 });
  const authorization = await authorize(parsed.data.courseId); if ("response" in authorization) return authorization.response;
  const asset = await prisma.asset.findUnique({ where: { id: parsed.data.assetId }, select: { id: true } });
  if (!asset) return NextResponse.json({ error: "找不到資產" }, { status: 404 });
  const aggregate = await prisma.courseResource.aggregate({ where: { courseId: parsed.data.courseId }, _max: { sortOrder: true } });
  const nextSortOrder = (aggregate._max.sortOrder ?? -1) + 1;
  await prisma.courseResource.upsert({ where: { courseId_assetId: { courseId: parsed.data.courseId, assetId: parsed.data.assetId } }, update: { title: parsed.data.title }, create: { courseId: parsed.data.courseId, assetId: parsed.data.assetId, title: parsed.data.title, sortOrder: nextSortOrder } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const parsed = assignmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "欄位格式錯誤" }, { status: 400 });
  const authorization = await authorize(parsed.data.courseId); if ("response" in authorization) return authorization.response;
  const resource = await prisma.courseResource.findUnique({
    where: { courseId_assetId: { courseId: parsed.data.courseId, assetId: parsed.data.assetId } },
    include: { _count: { select: { submissions: true, pageUnderstandingStates: true, pageUnderstandingEvents: true, pageVisits: true } } },
  });
  if (!resource) return NextResponse.json({ ok: true });
  const learningRecordCount = resource._count.submissions + resource._count.pageUnderstandingStates + resource._count.pageUnderstandingEvents + resource._count.pageVisits;
  if (learningRecordCount > 0 && !parsed.data.confirmDataLoss) {
    return NextResponse.json({ error: "此教材已有學生學習紀錄，需要再次確認後才能移除", requiresConfirmation: true, learningRecordCount }, { status: 409 });
  }
  await prisma.courseResource.delete({ where: { id: resource.id } });
  return NextResponse.json({ ok: true, deletedLearningRecords: learningRecordCount });
}

export async function PATCH(request: Request) {
  const parsed = reorderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "教材排序格式錯誤" }, { status: 400 });
  const authorization = await authorize(parsed.data.courseId); if ("response" in authorization) return authorization.response;
  const resources = await prisma.courseResource.findMany({ where: { courseId: parsed.data.courseId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const currentIndex = resources.findIndex((resource) => resource.id === parsed.data.resourceId);
  if (currentIndex < 0) return NextResponse.json({ error: "找不到指定教材" }, { status: 404 });
  const targetIndex = parsed.data.direction === "UP" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= resources.length) return NextResponse.json({ ok: true });
  const reordered = [...resources];
  [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
  await prisma.$transaction(reordered.map((resource, index) => prisma.courseResource.update({ where: { id: resource.id }, data: { sortOrder: index } })));
  return NextResponse.json({ ok: true });
}
