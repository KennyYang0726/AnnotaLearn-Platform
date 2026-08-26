import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireApiAdmin } from "@/lib/auth/api";

export async function POST(request: Request) {
  if (process.env.STORAGE_DRIVER !== "blob") return NextResponse.json({ error: "目前不是Blob儲存模式" }, { status: 400 });
  const body = (await request.json()) as HandleUploadBody;
  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const auth = await requireApiAdmin();
        if (!auth.ok) throw new Error(auth.error);
        if (!pathname.toLowerCase().endsWith(".pdf")) throw new Error("僅允許PDF檔案");
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: 100 * 1024 * 1024,
          addRandomSuffix: false,
          tokenPayload: JSON.stringify({ adminId: auth.user.id }),
        };
      },
      onUploadCompleted: async () => {
        // 資料庫登錄由前端上傳完成後呼叫 blob-finalize 完成；此處刻意不做資料異動。
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Blob上傳驗證失敗" }, { status: 400 });
  }
}
