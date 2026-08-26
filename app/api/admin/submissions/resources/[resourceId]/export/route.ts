import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db";

type Geometry = { points?: unknown };

type CsvRow = Array<string | number | null | undefined>;

function csvCell(value: string | number | null | undefined) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csvLine(row: CsvRow) {
  return row.map(csvCell).join(",");
}

export async function GET(_request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { resourceId } = await params;
  const resource = await prisma.courseResource.findUnique({
    where: { id: resourceId },
    include: {
      asset: true,
      course: {
        include: {
          semester: true,
          enrollments: { include: { user: true } },
        },
      },
      submissions: {
        include: {
          notes: { orderBy: [{ page: "asc" }, { createdAt: "asc" }] },
          highlights: { orderBy: [{ page: "asc" }, { createdAt: "asc" }] },
        },
      },
    },
  });

  if (!resource) return NextResponse.json({ error: "找不到教材" }, { status: 404 });

  const submissions = new Map(resource.submissions.map((submission) => [submission.userId, submission]));
  const rows: CsvRow[] = [[
    "學期", "課程ID", "課程名稱", "教材名稱", "PDF檔名", "學號", "姓名", "系級",
    "繳交狀態", "繳交時間", "最後閱讀頁", "紀錄類型", "分類", "頁碼", "文字內容", "螢光筆顏色", "劃記座標",
  ]];

  const enrollments = [...resource.course.enrollments].sort((a, b) => a.user.username.localeCompare(b.user.username));
  for (const enrollment of enrollments) {
    const user = enrollment.user;
    const submission = submissions.get(user.id);
    const common: CsvRow = [
      resource.course.semester.code,
      resource.course.courseCode,
      resource.course.name,
      resource.title,
      resource.asset.originalName,
      user.username,
      user.displayName,
      user.departmentGrade,
      submission ? "已繳交" : "尚未繳交",
      submission?.submittedAt ? submission.submittedAt.toISOString() : "",
      submission?.lastPage ?? "",
    ];

    if (!submission) {
      rows.push([...common, "", "", "", "", "", ""]);
      continue;
    }

    const records: Array<{ createdAt: Date; row: CsvRow }> = [];
    for (const note of submission.notes) {
      records.push({
        createdAt: note.createdAt,
        row: [...common, "文字筆記", note.type === "KEY_POINT" ? "重點" : "盲點提問", note.page, note.content, "", ""],
      });
    }
    for (const highlight of submission.highlights) {
      const geometry = highlight.geometry as Geometry;
      records.push({
        createdAt: highlight.createdAt,
        row: [
          ...common,
          "螢光筆劃記",
          highlight.type === "IMPORTANT" ? "重點" : "疑問",
          highlight.page,
          highlight.extractedText || "",
          highlight.color === "RED" ? "紅色" : "黃色",
          JSON.stringify(geometry.points ?? []),
        ],
      });
    }

    if (records.length === 0) {
      rows.push([...common, "", "", "", "", "", ""]);
    } else {
      records.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      rows.push(...records.map((record) => record.row));
    }
  }

  const csv = "\uFEFF" + rows.map(csvLine).join("\r\n");
  const filename = `${resource.course.courseCode}-${resource.id}-reading-records.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
