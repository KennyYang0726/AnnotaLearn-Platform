import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { requireApiAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { localStorageRoot, safeLocalFilename, storageDriver } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiAdmin(); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (storageDriver() !== "local") return NextResponse.json({ error: "目前不是本機儲存模式" }, { status: 400 });
  const form = await request.formData();
  const file = form.get("file");
  const displayName = String(form.get("displayName") || "").trim();
  const pageCount = Number(form.get("pageCount") || 0) || null;
  if (!(file instanceof File)) return NextResponse.json({ error: "缺少PDF檔案" }, { status: 400 });
  if (file.size > 100 * 1024 * 1024) return NextResponse.json({ error: "單一PDF檔案上限為100MB" }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = new TextDecoder().decode(bytes.slice(0, 5));
  if (signature !== "%PDF-") return NextResponse.json({ error: "檔案內容不是有效PDF" }, { status: 400 });
  const storageKey = `${randomUUID()}-${safeLocalFilename(file.name)}`;
  const root = localStorageRoot(); await mkdir(root, { recursive: true }); await writeFile(path.join(root, storageKey), bytes);
  const asset = await prisma.asset.create({ data: { originalName: file.name, displayName: displayName || file.name.replace(/\.pdf$/i, ""), storageProvider: "local", storageKey, fileSize: file.size, pageCount, mimeType: "application/pdf" } });
  return NextResponse.json({ asset });
}
