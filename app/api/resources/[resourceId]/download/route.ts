import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getAuthorizedResource } from "@/lib/resource-access";
import { createAssetDownloadResponse } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { resourceId } = await params;
  const resource = await getAuthorizedResource(resourceId, auth.user);
  if (!resource) return NextResponse.json({ error: "找不到教材或沒有存取權限" }, { status: 404 });
  if (auth.user.role === "STUDENT" && !resource.course.allowMaterialDownload) return NextResponse.json({ error: "此課程未開放教材下載" }, { status: 403 });

  try {
    const response = await createAssetDownloadResponse(resource.asset);
    return response ?? NextResponse.json({ error: "教材檔案不存在" }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "教材下載失敗" }, { status: 500 });
  }
}
