import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { APP_TIME_ZONE } from "@/lib/app-timezone";
import { activityDateWhere, type ActivityFilters, recordedAtWhere } from "@/lib/activity-filter";
import { browsingProgressPercent, distinctVisitedPages, pageListLabel, understandingLabel } from "@/lib/reading-analytics";
import { formatDuration } from "@/lib/reading-activity";

type Geometry = { points?: unknown };
type CsvRow = Array<string | number | null | undefined>;
export type ResearchExportIdentityMode = "IDENTIFIED" | "DEIDENTIFIED";

type ResearchExportOptions = {
  identityMode?: ResearchExportIdentityMode;
};

function csvCell(value: string | number | null | undefined) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csvLine(row: CsvRow) {
  return row.map(csvCell).join(",");
}

function isoDateTime(value: Date | null | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const zoneName = get("timeZoneName");
  const offset = zoneName === "GMT" ? "Z" : zoneName.replace(/^GMT/, "");
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}.${String(value.getUTCMilliseconds()).padStart(3, "0")}${offset}`;
}

function submissionStatusLabel(status?: "DRAFT" | "SUBMITTED") {
  if (status === "SUBMITTED") return "已繳交";
  if (status === "DRAFT") return "草稿未繳交";
  return "尚未繳交";
}

function annotationActionLabel(action: "CREATE" | "UPDATE" | "DELETE") {
  if (action === "CREATE") return "建立";
  if (action === "UPDATE") return "更新";
  return "刪除";
}

function annotationSourceLabel(source: "AUTO_SYNC" | "SUBMIT_SYNC") {
  return source === "AUTO_SYNC" ? "即時自動同步" : "繳交補同步";
}

function anonymousSubjectId(courseId: string, userId: string) {
  const digest = createHash("sha256").update(`${courseId}:${userId}`).digest("hex").slice(0, 12).toUpperCase();
  return `P-${digest}`;
}

function annotationLifecycleKey(userId: string, entityType: "NOTE" | "HIGHLIGHT", clientId: string) {
  return `${userId}:${entityType}:${clientId}`;
}

function understandingLifecycleKey(userId: string, page: number) {
  return `${userId}:${page}`;
}

export async function buildResearchCsv(resourceId: string, filters: ActivityFilters, options: ResearchExportOptions = {}) {
  const identityMode = options.identityMode ?? "IDENTIFIED";
  const dateWhere = recordedAtWhere(filters);
  const dailyDateWhere = activityDateWhere(filters);
  const resource = await prisma.courseResource.findUnique({
    where: { id: resourceId },
    include: { asset: true, course: { include: { semester: true, enrollments: { include: { user: true } } } } },
  });
  if (!resource) return null;

  const userIds = resource.course.enrollments.map((enrollment) => enrollment.userId);
  const noteWhere = { ...(dateWhere ? { recordedAt: dateWhere } : {}), ...(filters.noteType !== "ALL" ? { type: filters.noteType } : {}), ...(filters.page ? { page: filters.page } : {}) };
  const highlightWhere = { ...(dateWhere ? { recordedAt: dateWhere } : {}), ...(filters.highlightColor !== "ALL" ? { color: filters.highlightColor } : {}), ...(filters.page ? { page: filters.page } : {}) };
  const needsFullUnderstandingLifecycle = Boolean(dateWhere || filters.page);
  const needsFullAnnotationLifecycle = Boolean(dateWhere || filters.page);

  const [
    submissions,
    states,
    understandingEvents,
    allVisits,
    filteredVisits,
    courseDaily,
    resourceDaily,
    annotationEvents,
    fullUnderstandingEventsResult,
    fullAnnotationEventsResult,
  ] = await Promise.all([
    prisma.readingSubmission.findMany({
      where: { resourceId, userId: { in: userIds } },
      include: {
        notes: { where: noteWhere, orderBy: [{ page: "asc" }, { recordedAt: "asc" }] },
        highlights: { where: highlightWhere, orderBy: [{ page: "asc" }, { recordedAt: "asc" }] },
      },
    }),
    prisma.pageUnderstandingState.findMany({
      where: { resourceId, userId: { in: userIds } },
      select: { userId: true, page: true, status: true, selectedAt: true, updatedAt: true },
      orderBy: [{ userId: "asc" }, { page: "asc" }],
    }),
    prisma.pageUnderstandingEvent.findMany({
      where: { resourceId, userId: { in: userIds }, ...(dateWhere ? { recordedAt: dateWhere } : {}), ...(filters.page ? { page: filters.page } : {}) },
      orderBy: { recordedAt: "asc" },
    }),
    prisma.pageVisit.findMany({ where: { resourceId, userId: { in: userIds } }, select: { userId: true, page: true } }),
    prisma.pageVisit.findMany({
      where: { resourceId, userId: { in: userIds }, ...(dateWhere ? { enteredAt: dateWhere } : {}), ...(filters.page ? { page: filters.page } : {}) },
      select: { id: true, clientVisitId: true, readerSessionId: true, userId: true, page: true, durationSeconds: true, enteredAt: true, lastSeenAt: true, leftAt: true, endReason: true },
      orderBy: { enteredAt: "asc" },
    }),
    prisma.courseDailyActivity.findMany({ where: { courseId: resource.courseId, userId: { in: userIds }, ...(dailyDateWhere ? { activityDate: dailyDateWhere } : {}) }, orderBy: { activityDate: "asc" } }),
    prisma.resourceDailyActivity.findMany({ where: { resourceId, userId: { in: userIds }, ...(dailyDateWhere ? { activityDate: dailyDateWhere } : {}) }, orderBy: { activityDate: "asc" } }),
    prisma.annotationEvent.findMany({ where: { resourceId, userId: { in: userIds }, ...(dateWhere ? { recordedAt: dateWhere } : {}), ...(filters.page ? { page: filters.page } : {}) }, orderBy: { recordedAt: "asc" } }),
    needsFullUnderstandingLifecycle
      ? prisma.pageUnderstandingEvent.findMany({ where: { resourceId, userId: { in: userIds } }, select: { userId: true, page: true, recordedAt: true }, orderBy: { recordedAt: "asc" } })
      : Promise.resolve(null),
    needsFullAnnotationLifecycle
      ? prisma.annotationEvent.findMany({ where: { resourceId, userId: { in: userIds } }, select: { userId: true, clientId: true, entityType: true, action: true, recordedAt: true }, orderBy: { recordedAt: "asc" } })
      : Promise.resolve(null),
  ]);

  const understandingLifecycleEvents = fullUnderstandingEventsResult ?? understandingEvents;
  const annotationLifecycleEvents = fullAnnotationEventsResult ?? annotationEvents;

  const firstUnderstandingEventAt = new Map<string, Date>();
  for (const event of understandingLifecycleEvents) {
    const key = understandingLifecycleKey(event.userId, event.page);
    const current = firstUnderstandingEventAt.get(key);
    if (!current || event.recordedAt < current) firstUnderstandingEventAt.set(key, event.recordedAt);
  }

  const lastAnnotationUpdateAt = new Map<string, Date>();
  for (const event of annotationLifecycleEvents) {
    if (event.action !== "UPDATE") continue;
    const key = annotationLifecycleKey(event.userId, event.entityType, event.clientId);
    const current = lastAnnotationUpdateAt.get(key);
    if (!current || event.recordedAt > current) lastAnnotationUpdateAt.set(key, event.recordedAt);
  }

  const byUser = <T extends { userId: string }>(items: T[]) => {
    const map = new Map<string, T[]>();
    for (const item of items) map.set(item.userId, [...(map.get(item.userId) ?? []), item]);
    return map;
  };
  const submissionsByUser = new Map(submissions.map((submission) => [submission.userId, submission]));
  const statesByUser = byUser(states);
  const understandingEventsByUser = byUser(understandingEvents);
  const allVisitsByUser = byUser(allVisits);
  const visitsByUser = byUser(filteredVisits);
  const courseDailyByUser = byUser(courseDaily);
  const resourceDailyByUser = byUser(resourceDaily);
  const annotationEventsByUser = byUser(annotationEvents);

  const identityHeaders = identityMode === "DEIDENTIFIED"
    ? ["匿名受試者ID", "系級"]
    : ["學號", "姓名", "系級"];
  const recordHeaders = [
    "紀錄類型", "分類/狀態", "事件動作", "事件來源", "頁碼", "該頁第幾次停留",
    "頁面停留時間", "停留秒數", "建立時間", "最後更新時間", "事件時間", "進入時間", "最後心跳時間", "離開時間", "結束原因",
    "閱讀Session ID", "Server Visit ID", "Client Visit ID", "Annotation ID", "文字內容", "螢光筆顏色", "劃記座標",
  ];
  const rows: CsvRow[] = [[
    "學期", "課程ID", "課程名稱", "課程起始時間", "課程結束時間", "教材名稱", "PDF檔名", "PDF總頁數",
    ...identityHeaders,
    "繳交狀態", "首次繳交時間", "最近繳交時間", "繳交次數", "最後閱讀頁",
    "全期已瀏覽頁數", "教材瀏覽進度(全期)(%)", "篩選期間已瀏覽頁數", "目前自陳不理解頁面", "目前自陳已理解頁面",
    "課程活動天數", "教材閱讀天數", ...recordHeaders,
  ]];

  const studentKeyword = filters.student.toLocaleLowerCase("zh-TW");
  const enrollments = [...resource.course.enrollments]
    .sort((a, b) => a.user.username.localeCompare(b.user.username))
    .filter((enrollment) => !studentKeyword || `${enrollment.user.username} ${enrollment.user.displayName ?? ""}`.toLocaleLowerCase("zh-TW").includes(studentKeyword));

  for (const enrollment of enrollments) {
    const user = enrollment.user;
    const submission = submissionsByUser.get(user.id);
    const userStates = statesByUser.get(user.id) ?? [];
    const userUnderstandingEvents = understandingEventsByUser.get(user.id) ?? [];
    const userAllVisits = allVisitsByUser.get(user.id) ?? [];
    const userVisits = visitsByUser.get(user.id) ?? [];
    const userCourseDaily = courseDailyByUser.get(user.id) ?? [];
    const userResourceDaily = resourceDailyByUser.get(user.id) ?? [];
    const userAnnotationEvents = annotationEventsByUser.get(user.id) ?? [];
    const visitedPages = distinctVisitedPages(userAllVisits);
    const periodVisitedPages = distinctVisitedPages(userVisits);
    const browsingProgress = browsingProgressPercent(visitedPages.length, resource.asset.pageCount);
    const notUnderstoodPages = userStates.filter((state) => state.status === "NOT_UNDERSTOOD").map((state) => state.page);
    const understoodPages = userStates.filter((state) => state.status === "UNDERSTOOD").map((state) => state.page);

    if (filters.understanding !== "ALL") {
      if (filters.page) {
        const pageState = userStates.find((state) => state.page === filters.page);
        if (filters.understanding === "UNSET" ? Boolean(pageState) : pageState?.status !== filters.understanding) continue;
      } else if (filters.understanding === "UNDERSTOOD" && !userStates.some((state) => state.status === "UNDERSTOOD")) continue;
      else if (filters.understanding === "NOT_UNDERSTOOD" && !userStates.some((state) => state.status === "NOT_UNDERSTOOD")) continue;
      else if (filters.understanding === "UNSET" && (resource.asset.pageCount ? userStates.length >= resource.asset.pageCount : userStates.length > 0)) continue;
    }
    if (filters.completion === "NOT_STARTED" && visitedPages.length !== 0) continue;
    if (filters.completion === "COMPLETE" && browsingProgress !== 100) continue;
    if (filters.completion === "INCOMPLETE" && (visitedPages.length === 0 || browsingProgress === 100)) continue;

    const identityValues: CsvRow = identityMode === "DEIDENTIFIED"
      ? [anonymousSubjectId(resource.courseId, user.id), user.departmentGrade]
      : [user.username, user.displayName, user.departmentGrade];
    const common: CsvRow = [
      resource.course.semester.code, resource.course.courseCode, resource.course.name, isoDateTime(resource.course.startAt), isoDateTime(resource.course.endAt),
      resource.title, resource.asset.originalName, resource.asset.pageCount ?? "", ...identityValues,
      submissionStatusLabel(submission?.status), isoDateTime(submission?.firstSubmittedAt), isoDateTime(submission?.lastSubmittedAt),
      submission?.submissionCount ?? 0, submission?.lastPage ?? "", visitedPages.length, browsingProgress ?? "", periodVisitedPages.length,
      pageListLabel(notUnderstoodPages), pageListLabel(understoodPages), userCourseDaily.length, userResourceDaily.length,
    ];
    const recordRows: CsvRow[] = [];
    const push = (values: CsvRow) => recordRows.push([...common, ...values]);

    if (filters.recordType === "ALL" || filters.recordType === "NOTE") {
      for (const note of submission?.notes ?? []) {
        const updatedAt = lastAnnotationUpdateAt.get(annotationLifecycleKey(user.id, "NOTE", note.clientId)) ?? note.recordedAt;
        push(["文字筆記目前狀態", note.type === "KEY_POINT" ? "重點" : "盲點提問", "", "", note.page, "", "", "", isoDateTime(note.recordedAt), isoDateTime(updatedAt), "", "", "", "", "", "", "", "", note.clientId, note.content, "", ""]);
      }
    }
    if (filters.recordType === "ALL" || filters.recordType === "HIGHLIGHT") {
      for (const highlight of submission?.highlights ?? []) {
        const geometry = highlight.geometry as Geometry;
        const updatedAt = lastAnnotationUpdateAt.get(annotationLifecycleKey(user.id, "HIGHLIGHT", highlight.clientId)) ?? highlight.recordedAt;
        push(["PDF劃記目前狀態", highlight.type === "IMPORTANT" ? "重點" : "疑問", "", "", highlight.page, "", "", "", isoDateTime(highlight.recordedAt), isoDateTime(updatedAt), "", "", "", "", "", "", "", "", highlight.clientId, highlight.extractedText || "", highlight.color === "RED" ? "紅色" : "黃色", JSON.stringify(geometry.points ?? [])]);
      }
    }
    if (filters.recordType === "ALL" || filters.recordType === "UNDERSTANDING") {
      const currentStates = filters.page ? userStates.filter((state) => state.page === filters.page) : userStates;
      for (const state of currentStates) {
        const createdAt = firstUnderstandingEventAt.get(understandingLifecycleKey(user.id, state.page)) ?? state.selectedAt;
        push(["自陳理解目前狀態", understandingLabel(state.status), "", "", state.page, "", "", "", isoDateTime(createdAt), isoDateTime(state.updatedAt), "", "", "", "", "", "", "", "", "", "", "", ""]);
      }
      for (const event of userUnderstandingEvents) {
        push(["自陳理解狀態歷程", understandingLabel(event.status), "", "", event.page, "", "", "", "", "", isoDateTime(event.recordedAt), "", "", "", "", "", "", "", "", "", "", ""]);
      }
    }
    if (filters.recordType === "ALL" || filters.recordType === "VISIT") {
      const occurrenceByPage = new Map<number, number>();
      for (const visit of userVisits) {
        const occurrence = (occurrenceByPage.get(visit.page) ?? 0) + 1;
        occurrenceByPage.set(visit.page, occurrence);
        push(["頁面停留時間紀錄", "", "", "", visit.page, occurrence, formatDuration(visit.durationSeconds), visit.durationSeconds, "", "", "", isoDateTime(visit.enteredAt), isoDateTime(visit.lastSeenAt), isoDateTime(visit.leftAt), visit.endReason || "", visit.readerSessionId, visit.id, visit.clientVisitId, "", "", "", ""]);
      }
    }
    if (filters.recordType === "ALL" || filters.recordType === "DAILY_ACTIVITY") {
      for (const activity of userCourseDaily) {
        push(["課程活動日", "", "", "", "", "", "", "", "", "", activity.activityDate.toISOString().slice(0, 10), "", "", "", "", "", "", "", "", "", "", ""]);
      }
    }
    if (filters.recordType === "ALL" || filters.recordType === "RESOURCE_DAILY_ACTIVITY") {
      for (const activity of userResourceDaily) {
        push(["教材閱讀日", "", "", "", "", "", "", "", "", "", activity.activityDate.toISOString().slice(0, 10), "", "", "", "", "", "", "", "", "", "", ""]);
      }
    }
    if (filters.recordType === "ALL" || filters.recordType === "ANNOTATION_EVENT") {
      for (const event of userAnnotationEvents) {
        const geometry = event.geometry as Geometry | null;
        const category = event.entityType === "NOTE" ? (event.noteType === "KEY_POINT" ? "重點筆記" : "盲點提問") : (event.highlightType === "IMPORTANT" ? "重點劃記" : "疑問劃記");
        push(["註記事件歷程", category, annotationActionLabel(event.action), annotationSourceLabel(event.source), event.page, "", "", "", "", "", isoDateTime(event.recordedAt), "", "", "", "", "", "", "", event.clientId, event.content || event.extractedText || "", event.color === "RED" ? "紅色" : event.color === "YELLOW" ? "黃色" : "", JSON.stringify(geometry?.points ?? [])]);
      }
    }

    const requiresMatchingRecord = filters.recordType !== "ALL" || Boolean(filters.from || filters.to || filters.noteType !== "ALL" || filters.highlightColor !== "ALL" || filters.page);
    if (recordRows.length > 0) rows.push(...recordRows);
    else if (!requiresMatchingRecord) rows.push([...common, ...Array(recordHeaders.length).fill("")]);
  }

  const csv = "\uFEFF" + rows.map(csvLine).join("\r\n");
  const range = filters.from || filters.to ? `-${filters.from || "start"}-${filters.to || "end"}` : "";
  const identitySuffix = identityMode === "DEIDENTIFIED" ? "deidentified" : "identified";
  const filename = `${resource.course.courseCode}-${resource.id}${range}-${identitySuffix}-reading-records.csv`;
  return { csv, filename, courseId: resource.courseId };
}
