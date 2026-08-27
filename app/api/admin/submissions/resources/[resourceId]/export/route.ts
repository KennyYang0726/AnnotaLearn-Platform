import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import {
  activityDateWhere,
  formatTaipeiDate,
  formatTaipeiDateTime,
  parseActivityFilters,
  recordedAtWhere,
} from "@/lib/activity-filter";
import { completionPercent, distinctVisitedPages, pageListLabel, understandingLabel } from "@/lib/reading-analytics";
import { formatDuration } from "@/lib/reading-activity";

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

export async function GET(request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const filters = parseActivityFilters(new URL(request.url).searchParams);
  const dateWhere = recordedAtWhere(filters);
  const dailyDateWhere = activityDateWhere(filters);
  const { resourceId } = await params;

  const resource = await prisma.courseResource.findUnique({
    where: { id: resourceId },
    include: {
      asset: true,
      course: { include: { semester: true, enrollments: { include: { user: true } } } },
    },
  });
  if (!resource) return NextResponse.json({ error: "找不到教材" }, { status: 404 });

  const userIds = resource.course.enrollments.map((enrollment) => enrollment.userId);
  const noteWhere = {
    ...(dateWhere ? { recordedAt: dateWhere } : {}),
    ...(filters.noteType !== "ALL" ? { type: filters.noteType } : {}),
    ...(filters.page ? { page: filters.page } : {}),
  };
  const highlightWhere = {
    ...(dateWhere ? { recordedAt: dateWhere } : {}),
    ...(filters.highlightColor !== "ALL" ? { color: filters.highlightColor } : {}),
    ...(filters.page ? { page: filters.page } : {}),
  };

  const [submissions, states, events, allVisits, filteredVisits, dailyActivities] = await Promise.all([
    prisma.readingSubmission.findMany({
      where: { resourceId, userId: { in: userIds } },
      include: {
        notes: { where: noteWhere, orderBy: [{ page: "asc" }, { recordedAt: "asc" }] },
        highlights: { where: highlightWhere, orderBy: [{ page: "asc" }, { recordedAt: "asc" }] },
      },
    }),
    prisma.pageUnderstandingState.findMany({
      where: { resourceId, userId: { in: userIds } },
      select: { userId: true, page: true, status: true },
    }),
    prisma.pageUnderstandingEvent.findMany({
      where: {
        resourceId,
        userId: { in: userIds },
        ...(dateWhere ? { recordedAt: dateWhere } : {}),
        ...(filters.page ? { page: filters.page } : {}),
      },
      orderBy: { recordedAt: "asc" },
    }),
    prisma.pageVisit.findMany({
      where: { resourceId, userId: { in: userIds } },
      select: { userId: true, page: true },
    }),
    prisma.pageVisit.findMany({
      where: {
        resourceId,
        userId: { in: userIds },
        ...(dateWhere ? { enteredAt: dateWhere } : {}),
        ...(filters.page ? { page: filters.page } : {}),
      },
      select: { id: true, userId: true, page: true, durationSeconds: true, enteredAt: true },
      orderBy: { enteredAt: "asc" },
    }),
    prisma.courseDailyActivity.findMany({
      where: {
        courseId: resource.courseId,
        userId: { in: userIds },
        ...(dailyDateWhere ? { activityDate: dailyDateWhere } : {}),
      },
      orderBy: { activityDate: "asc" },
    }),
  ]);

  const submissionsByUser = new Map(submissions.map((submission) => [submission.userId, submission]));
  const statesByUser = new Map<string, typeof states>();
  const eventsByUser = new Map<string, typeof events>();
  const allVisitsByUser = new Map<string, typeof allVisits>();
  const visitsByUser = new Map<string, typeof filteredVisits>();
  const dailyByUser = new Map<string, typeof dailyActivities>();
  for (const state of states) statesByUser.set(state.userId, [...(statesByUser.get(state.userId) ?? []), state]);
  for (const event of events) eventsByUser.set(event.userId, [...(eventsByUser.get(event.userId) ?? []), event]);
  for (const visit of allVisits) allVisitsByUser.set(visit.userId, [...(allVisitsByUser.get(visit.userId) ?? []), visit]);
  for (const visit of filteredVisits) visitsByUser.set(visit.userId, [...(visitsByUser.get(visit.userId) ?? []), visit]);
  for (const activity of dailyActivities) dailyByUser.set(activity.userId, [...(dailyByUser.get(activity.userId) ?? []), activity]);

  const rows: CsvRow[] = [[
    "學期",
    "課程ID",
    "課程名稱",
    "課程起始時間",
    "課程結束時間",
    "教材名稱",
    "PDF檔名",
    "PDF總頁數",
    "學號",
    "姓名",
    "系級",
    "繳交狀態",
    "繳交時間",
    "最後閱讀頁",
    "已閱讀頁數",
    "完成率(%)",
    "最終不理解頁面",
    "最終已理解頁面",
    "學習活動天數",
    "紀錄類型",
    "分類/狀態",
    "頁碼",
    "該頁第幾次停留",
    "停留時間",
    "停留秒數",
    "紀錄日期",
    "文字內容",
    "螢光筆顏色",
    "劃記座標",
  ]];

  const studentKeyword = filters.student.toLocaleLowerCase("zh-TW");
  const enrollments = [...resource.course.enrollments]
    .sort((a, b) => a.user.username.localeCompare(b.user.username))
    .filter((enrollment) => !studentKeyword || `${enrollment.user.username} ${enrollment.user.displayName ?? ""}`.toLocaleLowerCase("zh-TW").includes(studentKeyword));

  for (const enrollment of enrollments) {
    const user = enrollment.user;
    const submission = submissionsByUser.get(user.id);
    const userStates = statesByUser.get(user.id) ?? [];
    const userEvents = eventsByUser.get(user.id) ?? [];
    const userAllVisits = allVisitsByUser.get(user.id) ?? [];
    const userVisits = visitsByUser.get(user.id) ?? [];
    const userDaily = dailyByUser.get(user.id) ?? [];
    const visitedPages = distinctVisitedPages(userAllVisits);
    const completion = completionPercent(visitedPages.length, resource.asset.pageCount);
    const notUnderstoodPages = userStates.filter((state) => state.status === "NOT_UNDERSTOOD").map((state) => state.page);
    const understoodPages = userStates.filter((state) => state.status === "UNDERSTOOD").map((state) => state.page);

    if (filters.understanding !== "ALL") {
      if (filters.page) {
        const pageState = userStates.find((state) => state.page === filters.page);
        if (filters.understanding === "UNSET" ? Boolean(pageState) : pageState?.status !== filters.understanding) continue;
      } else if (filters.understanding === "UNDERSTOOD" && !userStates.some((state) => state.status === "UNDERSTOOD")) continue;
      else if (filters.understanding === "NOT_UNDERSTOOD" && !userStates.some((state) => state.status === "NOT_UNDERSTOOD")) continue;
      else if (filters.understanding === "UNSET") {
        if (resource.asset.pageCount ? userStates.length >= resource.asset.pageCount : userStates.length > 0) continue;
      }
    }

    if (filters.completion === "NOT_STARTED" && visitedPages.length !== 0) continue;
    if (filters.completion === "COMPLETE" && completion !== 100) continue;
    if (filters.completion === "INCOMPLETE" && (visitedPages.length === 0 || completion === 100)) continue;

    const common: CsvRow = [
      resource.course.semester.code,
      resource.course.courseCode,
      resource.course.name,
      formatTaipeiDateTime(resource.course.startAt),
      formatTaipeiDateTime(resource.course.endAt),
      resource.title,
      resource.asset.originalName,
      resource.asset.pageCount ?? "",
      user.username,
      user.displayName,
      user.departmentGrade,
      submission ? "已繳交" : "尚未繳交",
      submission?.submittedAt ? formatTaipeiDateTime(submission.submittedAt) : "",
      submission?.lastPage ?? "",
      visitedPages.length,
      completion ?? "",
      pageListLabel(notUnderstoodPages),
      pageListLabel(understoodPages),
      userDaily.length,
    ];

    const recordRows: CsvRow[] = [];

    if (filters.recordType === "ALL" || filters.recordType === "NOTE") {
      for (const note of submission?.notes ?? []) {
        recordRows.push([...common, "文字筆記", note.type === "KEY_POINT" ? "重點" : "盲點提問", note.page, "", "", "", formatTaipeiDate(note.recordedAt), note.content, "", ""]);
      }
    }

    if (filters.recordType === "ALL" || filters.recordType === "HIGHLIGHT") {
      for (const highlight of submission?.highlights ?? []) {
        const geometry = highlight.geometry as Geometry;
        recordRows.push([
          ...common,
          "PDF劃記",
          highlight.type === "IMPORTANT" ? "重點" : "疑問",
          highlight.page,
          "",
          "",
          "",
          formatTaipeiDate(highlight.recordedAt),
          highlight.extractedText || "",
          highlight.color === "RED" ? "紅色" : "黃色",
          JSON.stringify(geometry.points ?? []),
        ]);
      }
    }

    if (filters.recordType === "ALL" || filters.recordType === "UNDERSTANDING") {
      for (const event of userEvents) {
        recordRows.push([...common, "理解狀態歷程", understandingLabel(event.status), event.page, "", "", "", formatTaipeiDateTime(event.recordedAt), "", "", ""]);
      }
    }

    if (filters.recordType === "ALL" || filters.recordType === "VISIT") {
      const occurrenceByPage = new Map<number, number>();
      for (const visit of userVisits) {
        const occurrence = (occurrenceByPage.get(visit.page) ?? 0) + 1;
        occurrenceByPage.set(visit.page, occurrence);
        // Intentionally do not export enteredAt/leftAt. The research-facing value
        // is the duration of each separate visit, as requested.
        recordRows.push([...common, "停留時間紀錄", "", visit.page, occurrence, formatDuration(visit.durationSeconds), visit.durationSeconds, "", "", "", ""]);
      }
    }

    if (filters.recordType === "ALL" || filters.recordType === "DAILY_ACTIVITY") {
      for (const activity of userDaily) {
        recordRows.push([...common, "學習活動日", "", "", "", "", "", activity.activityDate.toISOString().slice(0, 10), "", "", ""]);
      }
    }

    const requiresMatchingRecord = filters.recordType !== "ALL" || Boolean(filters.from || filters.to || filters.noteType !== "ALL" || filters.highlightColor !== "ALL" || filters.page);
    if (recordRows.length > 0) rows.push(...recordRows);
    else if (!requiresMatchingRecord) rows.push([...common, "", "", "", "", "", "", "", "", "", ""]);
  }

  const csv = "\uFEFF" + rows.map(csvLine).join("\r\n");
  const range = filters.from || filters.to ? `-${filters.from || "start"}-${filters.to || "end"}` : "";
  const filename = `${resource.course.courseCode}-${resource.id}${range}-reading-records.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
