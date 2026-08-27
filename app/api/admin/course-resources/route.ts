import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth/api";

const assignmentSchema = z.object({ courseId: z.string().min(1), assetId: z.string().min(1), title: z.string().trim().min(1).max(180) });
const reorderSchema = z.object({ courseId: z.string().min(1), resourceId: z.string().min(1), direction: z.enum(["UP", "DOWN"]) });

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
  await prisma.courseResource.upsert({ where: { courseId_assetId: { courseId: parsed.data.courseId, assetId: parsed.data.assetId } }, update: { title: parsed.data.title }, create: { ...parsed.data, sortOrder: nextSortOrder } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const authResponse = await requireAdmin(); if (authResponse) return authResponse;
  const parsed = assignmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "欄位格式錯誤" }, { status: 400 });
  const resource = await prisma.courseResource.findUnique({ where: { courseId_assetId: { courseId: parsed.data.courseId, assetId: parsed.data.assetId } }, include: { _count: { select: { submissions: true } } } });
  if (resource?._count.submissions) return NextResponse.json({ error: "此教材已有學生繳交紀錄，為避免資料遺失不可直接移除" }, { status: 409 });
  if (resource) await prisma.courseResource.delete({ where: { id: resource.id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const authResponse = await requireAdmin(); if (authResponse) return authResponse;
  const parsed = reorderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "教材排序格式錯誤" }, { status: 400 });

  const resources = await prisma.courseResource.findMany({
    where: { courseId: parsed.data.courseId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const currentIndex = resources.findIndex((resource) => resource.id === parsed.data.resourceId);
  if (currentIndex < 0) return NextResponse.json({ error: "找不到指定教材" }, { status: 404 });
  const targetIndex = parsed.data.direction === "UP" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= resources.length) return NextResponse.json({ ok: true });

  const reordered = [...resources];
  [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
  await prisma.$transaction(reordered.map((resource, index) => prisma.courseResource.update({ where: { id: resource.id }, data: { sortOrder: index } })));
  return NextResponse.json({ ok: true });
}
