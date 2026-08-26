import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { createAssetDownloadResponse } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { assetId } = await params;
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) return NextResponse.json({ error: "找不到資產" }, { status: 404 });

  try {
    const response = await createAssetDownloadResponse(asset);
    return response ?? NextResponse.json({ error: "教材檔案不存在" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "教材下載失敗" }, { status: 500 });
  }
}
