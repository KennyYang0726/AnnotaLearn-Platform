import { NextResponse } from "next/server";
import { readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { del, list } from "@vercel/blob";
import { requireApiAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { localStorageRoot } from "@/lib/storage";

export const runtime = "nodejs";

const CONFIRM_TEXT = "確定清除";

async function clearBlobAssets() {
  let cursor: string | undefined;
  const urls: string[] = [];
  do {
    const result = await list({ prefix: "assets/", cursor, limit: 1000 });
    urls.push(...result.blobs.map((blob) => blob.url));
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);
  for (let index = 0; index < urls.length; index += 500) {
    await del(urls.slice(index, index + 500));
  }
}

async function clearLocalAssets() {
  const root = localStorageRoot();
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name !== ".gitkeep")
    .map((entry) => unlink(path.join(root, entry.name))));
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null) as { confirmation?: string } | null;
  if (body?.confirmation !== CONFIRM_TEXT) {
    return NextResponse.json({ error: "確認文字不正確" }, { status: 400 });
  }

  try {
    await clearLocalAssets();
    if (process.env.BLOB_READ_WRITE_TOKEN) await clearBlobAssets();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? `PDF檔案清除失敗：${error.message}` : "PDF檔案清除失敗" }, { status: 500 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.course.deleteMany();
      await tx.asset.deleteMany();
      await tx.semester.deleteMany();
      await tx.user.deleteMany({ where: { role: "STUDENT" } });
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? `資料庫清除失敗：${error.message}` : "資料庫清除失敗" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
