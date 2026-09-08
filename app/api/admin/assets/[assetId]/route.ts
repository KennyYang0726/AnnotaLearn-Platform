import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth/api";
import { deleteStoredAsset } from "@/lib/storage";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { assetId } = await params;
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { _count: { select: { resources: true } } },
  });
  if (!asset) return NextResponse.json({ error: "找不到指定資產" }, { status: 404 });

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
    return NextResponse.json({
      ok: true,
      warning: error instanceof Error
        ? `資產資料已刪除，但實體檔案清除失敗：${error.message}`
        : "資產資料已刪除，但實體檔案清除失敗",
    });
  }

  return NextResponse.json({ ok: true, removedFromCourses: asset._count.resources });
}
