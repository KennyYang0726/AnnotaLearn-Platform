import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { parseStudentRoster } from "@/lib/student-roster";
import { normalizeStudentId } from "@/lib/student-account";

export const runtime = "nodejs";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const STUDENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "請選擇Excel名單" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Excel名單上限10MB" }, { status: 413 });

    const rows = parseStudentRoster(new Uint8Array(await file.arrayBuffer()));
    const ids = Array.from(new Set(rows.map((row) => normalizeStudentId(row.studentId)).filter(Boolean)));
    const existing = ids.length
      ? await prisma.user.findMany({
          where: { OR: ids.map((username) => ({ username: { equals: username, mode: "insensitive" as const } })) },
          select: { username: true, role: true },
        })
      : [];
    const existingMap = new Map(existing.map((user) => [user.username.toUpperCase(), user.role]));
    const seen = new Set<string>();

    const preview = rows.map((row) => {
      const key = normalizeStudentId(row.studentId);
      let status: "NEW" | "EXISTS" | "DUPLICATE" | "INVALID" | "CONFLICT" = "NEW";
      let message = "可新增";
      if (!STUDENT_ID_PATTERN.test(key) || key.length > 50) { status = "INVALID"; message = "學號格式不合法"; }
      else if (seen.has(key)) { status = "DUPLICATE"; message = "名單內學號重複"; }
      else if (existingMap.get(key) === "ADMIN") { status = "CONFLICT"; message = "此帳號已由管理端帳號使用"; }
      else if (existingMap.get(key) === "STUDENT") { status = "EXISTS"; message = "學生已存在，匯入時更新名單資料但不重設密碼"; }
      seen.add(key);
      return { ...row, studentId: key, status, message };
    });

    const summary = {
      total: preview.length,
      newCount: preview.filter((row) => row.status === "NEW").length,
      existingCount: preview.filter((row) => row.status === "EXISTS").length,
      skippedCount: preview.filter((row) => !["NEW", "EXISTS"].includes(row.status)).length,
    };
    return NextResponse.json({ rows: preview, summary });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Excel名單解析失敗" }, { status: 400 });
  }
}
