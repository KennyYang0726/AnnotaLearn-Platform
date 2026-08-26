import "server-only";
import path from "node:path";
import { createReadStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import { del, get } from "@vercel/blob";

export type StorageDriver = "local" | "blob";

type StoredAsset = {
  storageProvider: string;
  storageKey: string;
  storageUrl?: string | null;
};

type DownloadableAsset = StoredAsset & {
  originalName: string;
  mimeType?: string | null;
};

export function storageDriver(): StorageDriver {
  return process.env.STORAGE_DRIVER === "blob" ? "blob" : "local";
}

export function localStorageRoot() {
  const configured = process.env.LOCAL_STORAGE_DIR || "storage/uploads";
  return path.resolve(process.cwd(), configured);
}

export function safeLocalFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function downloadDisposition(filename: string) {
  const fallback = filename
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_") || "material.pdf";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function downloadHeaders(asset: DownloadableAsset, size?: number | null) {
  const headers = new Headers({
    "Content-Type": asset.mimeType || "application/pdf",
    "Content-Disposition": downloadDisposition(asset.originalName),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (typeof size === "number" && Number.isFinite(size)) headers.set("Content-Length", String(size));
  return headers;
}

export async function createAssetDownloadResponse(asset: DownloadableAsset) {
  if (asset.storageProvider === "blob") {
    const result = await get(asset.storageKey, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return new Response(result.stream, {
      status: 200,
      headers: downloadHeaders(asset, result.blob.size),
    });
  }

  if (asset.storageProvider === "local") {
    const root = localStorageRoot();
    const filePath = path.resolve(root, asset.storageKey);
    if (!filePath.startsWith(root + path.sep)) throw new Error("非法檔案路徑");
    try {
      const info = await stat(filePath);
      const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
      return new Response(stream, {
        status: 200,
        headers: downloadHeaders(asset, info.size),
      });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return null;
      throw error;
    }
  }

  throw new Error(`不支援的儲存模式：${asset.storageProvider}`);
}

export async function deleteStoredAsset(asset: StoredAsset) {
  if (asset.storageProvider === "blob") {
    if (!asset.storageUrl) throw new Error("缺少Blob檔案網址");
    await del(asset.storageUrl);
    return;
  }

  if (asset.storageProvider === "local") {
    const root = localStorageRoot();
    const filePath = path.resolve(root, asset.storageKey);
    if (!filePath.startsWith(root + path.sep)) throw new Error("非法檔案路徑");
    await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
    return;
  }

  throw new Error(`不支援的儲存模式：${asset.storageProvider}`);
}
