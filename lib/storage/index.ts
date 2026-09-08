import "server-only";
import path from "node:path";
import { createReadStream } from "node:fs";
import { stat, unlink } from "node:fs/promises";
import { Readable } from "node:stream";

type StoredAsset = {
  storageProvider: string;
  storageKey: string;
};

type DownloadableAsset = StoredAsset & {
  originalName: string;
  mimeType?: string | null;
};

export function localStorageRoot() {
  const configured = process.env.LOCAL_STORAGE_DIR || "storage/uploads";
  return path.resolve(process.cwd(), configured);
}

export function safeLocalFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function resolveLocalAssetPath(asset: StoredAsset) {
  if (asset.storageProvider !== "local") {
    throw new Error("此資產不是本機檔案儲存格式");
  }
  const root = localStorageRoot();
  const filePath = path.resolve(root, asset.storageKey);
  if (!filePath.startsWith(root + path.sep)) throw new Error("非法檔案路徑");
  return filePath;
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
  const filePath = resolveLocalAssetPath(asset);
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

export async function deleteStoredAsset(asset: StoredAsset) {
  const filePath = resolveLocalAssetPath(asset);
  await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}
