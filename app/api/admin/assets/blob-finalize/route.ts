import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db";

const schema = z.object({ originalName: z.string().min(1).max(255), displayName: z.string().min(1).max(180), pathname: z.string().min(1), url: z.string().url(), fileSize: z.number().int().positive().max(100 * 1024 * 1024), pageCount: z.number().int().positive().max(10000) });
export async function POST(request: Request) {
  const auth = await requireApiAdmin(); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (process.env.STORAGE_DRIVER !== "blob") return NextResponse.json({ error: "目前不是Blob儲存模式" }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "資產資訊格式錯誤" }, { status: 400 });
  const host = new URL(parsed.data.url).hostname;
  if (!host.endsWith(".private.blob.vercel-storage.com")) return NextResponse.json({ error: "必須使用Vercel Private Blob" }, { status: 400 });
  try {
    const asset = await prisma.asset.create({ data: { originalName: parsed.data.originalName, displayName: parsed.data.displayName, storageProvider: "blob", storageKey: parsed.data.pathname, storageUrl: parsed.data.url, fileSize: parsed.data.fileSize, pageCount: parsed.data.pageCount, mimeType: "application/pdf" } });
    return NextResponse.json({ asset });
  } catch { return NextResponse.json({ error: "此Blob已登錄或資料庫寫入失敗" }, { status: 409 }); }
}
