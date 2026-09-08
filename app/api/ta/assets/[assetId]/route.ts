import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiTa } from "@/lib/auth/api";
import { deleteStoredAsset } from "@/lib/storage";
import { assignedCourseIdsForTa } from "@/lib/auth/course-access";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const auth = await requireApiTa();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { assetId } = await params;
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { resources: { select: { courseId: true } } },
  });
  if (!asset) return NextResponse.json({ error: "找不到指定資產" }, { status: 404 });
  if (asset.createdById !== auth.user.id) return NextResponse.json({ error: "助教只能永久刪除自己上傳的資產" }, { status: 403 });

  const assignedIds = new Set(await assignedCourseIdsForTa(auth.user.id));
  const outsideCourseCount = asset.resources.filter((resource) => !assignedIds.has(resource.courseId)).length;
  if (outsideCourseCount > 0) {
    return NextResponse.json({ error: `此資產另被${outsideCourseCount}門非你負責的課程使用，請交由管理員處理永久刪除` }, { status: 409 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.courseResource.deleteMany({ where: { assetId } });
      await tx.asset.delete({ where: { id: assetId } });
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "刪除資產資料失敗" }, { status: 500 });
  }

  try {
    await deleteStoredAsset(asset);
  } catch (error) {
    return NextResponse.json({ ok: true, warning: error instanceof Error ? `資產資料已刪除，但實體檔案清除失敗：${error.message}` : "資產資料已刪除，但實體檔案清除失敗" });
  }
  return NextResponse.json({ ok: true, removedFromCourses: asset.resources.length });
}
