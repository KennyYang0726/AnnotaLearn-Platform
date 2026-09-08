import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getAuthorizedResource } from "@/lib/resource-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  const auth = await requireApiUser();

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  const { resourceId } = await params;
  const resource = await getAuthorizedResource(resourceId, auth.user, { allowTa: true });

  if (!resource) {
    return NextResponse.json(
      { error: "找不到教材或沒有存取權限" },
      { status: 404 }
    );
  }

  if (resource.asset.storageProvider !== "local") {
    return NextResponse.json(
      { error: "此教材不是本機檔案儲存格式" },
      { status: 409 }
    );
  }

  return NextResponse.json({
    url: `/api/resources/${resource.id}/pdf`,
  });
}
