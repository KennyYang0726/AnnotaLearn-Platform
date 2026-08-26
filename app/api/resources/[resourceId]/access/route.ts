import { NextResponse } from "next/server";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import { requireApiUser } from "@/lib/auth/api";
import { getAuthorizedResource } from "@/lib/resource-access";

export async function GET(_request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const auth = await requireApiUser(); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { resourceId } = await params; const resource = await getAuthorizedResource(resourceId, auth.user);
  if (!resource) return NextResponse.json({ error: "找不到教材或沒有存取權限" }, { status: 404 });

  if (resource.asset.storageProvider === "blob") {
    const validUntil = Date.now() + 2 * 60 * 60 * 1000;
    const token = await issueSignedToken({ pathname: resource.asset.storageKey, operations: ["get"], validUntil });
    const { presignedUrl } = await presignUrl(token, { pathname: resource.asset.storageKey, operation: "get", validUntil });
    return NextResponse.json({ url: presignedUrl, expiresAt: new Date(validUntil).toISOString() });
  }
  return NextResponse.json({ url: `/api/resources/${resource.id}/pdf` });
}
