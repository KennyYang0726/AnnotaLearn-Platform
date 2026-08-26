import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireApiUser } from "@/lib/auth/api";
import { getAuthorizedResource } from "@/lib/resource-access";
import { localStorageRoot } from "@/lib/storage";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const auth = await requireApiUser(); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { resourceId } = await params; const resource = await getAuthorizedResource(resourceId, auth.user);
  if (!resource || resource.asset.storageProvider !== "local") return NextResponse.json({ error: "找不到本機PDF" }, { status: 404 });
  const root = localStorageRoot(); const filePath = path.resolve(root, resource.asset.storageKey);
  if (!filePath.startsWith(root + path.sep)) return NextResponse.json({ error: "非法路徑" }, { status: 400 });
  try {
    const bytes = await readFile(filePath);
    return new NextResponse(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(resource.asset.originalName)}`, "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "PDF檔案不存在" }, { status: 404 }); }
}
