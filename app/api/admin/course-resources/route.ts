import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseAppDateTimeLocal } from "@/lib/app-timezone";
import { requireApiAdmin } from "@/lib/auth/api";

const assignmentSchema = z.object({ courseId: z.string().min(1), assetId: z.string().min(1), title: z.string().trim().min(1).max(180), confirmDataLoss: z.boolean().optional().default(false) });
const reorderSchema = z.object({ courseId: z.string().min(1), resourceId: z.string().min(1), direction: z.enum(["UP", "DOWN"]) });
const settingsSchema = z.object({
  courseId: z.string().min(1),
  resourceId: z.string().min(1),
  sectionId: z.string().nullable().optional(),
  readingTaskEnabled: z.boolean(),
  availableFrom: z.string().optional().default(""),
  dueAt: z.string().optional().default(""),
});

async function requireAdmin() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return null;
}

export async function POST(request: Request) {
  const authResponse = await requireAdmin(); if (authResponse) return authResponse;
  const parsed = assignmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "欄位格式錯誤" }, { status: 400 });
  const aggregate = await prisma.courseResource.aggregate({ where: { courseId: parsed.data.courseId }, _max: { sortOrder: true } });
  const nextSortOrder = (aggregate._max.sortOrder ?? -1) + 1;
  await prisma.courseResource.upsert({ where: { courseId_assetId: { courseId: parsed.data.courseId, assetId: parsed.data.assetId } }, update: { title: parsed.data.title }, create: { courseId: parsed.data.courseId, assetId: parsed.data.assetId, title: parsed.data.title, sortOrder: nextSortOrder } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const authResponse = await requireAdmin(); if (authResponse) return authResponse;
  const parsed = assignmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "欄位格式錯誤" }, { status: 400 });
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
  const raw = await request.json().catch(() => null);
  if (!raw || typeof raw !== "object") return NextResponse.json({ error: "教材更新格式錯誤" }, { status: 400 });
  const authResponse = await requireAdmin(); if (authResponse) return authResponse;

  const settings = settingsSchema.safeParse(raw);
  if (settings.success) {
    const resource = await prisma.courseResource.findFirst({ where: { id: settings.data.resourceId, courseId: settings.data.courseId }, select: { id: true, sectionId: true } });
    if (!resource) return NextResponse.json({ error: "找不到指定教材" }, { status: 404 });
    if (settings.data.sectionId) {
      const section = await prisma.courseSection.findFirst({ where: { id: settings.data.sectionId, courseId: settings.data.courseId }, select: { id: true } });
      if (!section) return NextResponse.json({ error: "找不到指定課程單元" }, { status: 404 });
    }
    const availableFrom = settings.data.availableFrom ? parseAppDateTimeLocal(settings.data.availableFrom) : null;
    const dueAt = settings.data.dueAt ? parseAppDateTimeLocal(settings.data.dueAt) : null;
    if (settings.data.availableFrom && !availableFrom) return NextResponse.json({ error: "開放時間格式錯誤" }, { status: 400 });
    if (settings.data.dueAt && !dueAt) return NextResponse.json({ error: "截止時間格式錯誤" }, { status: 400 });
    if (availableFrom && dueAt && dueAt <= availableFrom) return NextResponse.json({ error: "截止時間必須晚於開放時間" }, { status: 400 });

    let sortOrderUpdate = {} as { sortOrder?: number };
    if ((settings.data.sectionId ?? null) !== resource.sectionId) {
      const aggregate = await prisma.courseResource.aggregate({ where: { courseId: settings.data.courseId, sectionId: settings.data.sectionId ?? null }, _max: { sortOrder: true } });
      sortOrderUpdate = { sortOrder: (aggregate._max.sortOrder ?? -1) + 1 };
    }
    await prisma.courseResource.update({
      where: { id: resource.id },
      data: {
        sectionId: settings.data.sectionId ?? null,
        readingTaskEnabled: settings.data.readingTaskEnabled,
        availableFrom: settings.data.readingTaskEnabled ? availableFrom : null,
        dueAt: settings.data.readingTaskEnabled ? dueAt : null,
        ...sortOrderUpdate,
      },
    });
    return NextResponse.json({ ok: true });
  }

  const parsed = reorderSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "教材排序格式錯誤" }, { status: 400 });
  const current = await prisma.courseResource.findFirst({ where: { id: parsed.data.resourceId, courseId: parsed.data.courseId }, select: { id: true, sectionId: true } });
  if (!current) return NextResponse.json({ error: "找不到指定教材" }, { status: 404 });
  const resources = await prisma.courseResource.findMany({
    where: { courseId: parsed.data.courseId, sectionId: current.sectionId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const currentIndex = resources.findIndex((resource) => resource.id === parsed.data.resourceId);
  const targetIndex = parsed.data.direction === "UP" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= resources.length) return NextResponse.json({ ok: true });
  const reordered = [...resources];
  [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
  await prisma.$transaction(reordered.map((resource, index) => prisma.courseResource.update({ where: { id: resource.id }, data: { sortOrder: index } })));
  return NextResponse.json({ ok: true });
}
