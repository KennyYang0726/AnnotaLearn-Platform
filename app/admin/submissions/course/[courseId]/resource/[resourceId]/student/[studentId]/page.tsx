import Link from "next/link";
import { notFound } from "next/navigation";
import StudentReadingRecordViewer from "@/components/admin/StudentReadingRecordViewer";
import { prisma } from "@/lib/db";
import { formatDbDateOnly } from "@/lib/app-timezone";
import {
  activityDateWhere,
  activityQuery,
  filterPeriodLabel,
  formatAppDateTime,
  parseActivityFilters,
  recordedAtWhere,
} from "@/lib/activity-filter";
import { browsingProgressPercent, distinctVisitedPages, pageListLabel, understandingLabel } from "@/lib/reading-analytics";
import { formatDuration } from "@/lib/reading-activity";

type Geometry = { points?: unknown[] };

export default async function StudentReadingRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; resourceId: string; studentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { courseId, resourceId, studentId } = await params;
  const filters = parseActivityFilters(await searchParams);
  const dateWhere = recordedAtWhere(filters);
  const dailyDateWhere = activityDateWhere(filters);

  const resource = await prisma.courseResource.findFirst({
    where: { id: resourceId, courseId },
    include: { asset: true, course: { include: { semester: true } } },
  });
  if (!resource) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: studentId, courseId } },
    include: { user: true },
  });
  if (!enrollment) notFound();

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

  const [submission, understandingStates, understandingEvents, allVisits, filteredVisits, dailyActivities, resourceDailyActivities] = await Promise.all([
    prisma.readingSubmission.findUnique({
      where: { userId_resourceId: { userId: studentId, resourceId } },
      include: {
        notes: { where: noteWhere, orderBy: [{ page: "asc" }, { recordedAt: "asc" }] },
        highlights: { where: highlightWhere, orderBy: [{ page: "asc" }, { recordedAt: "asc" }] },
      },
    }),
    prisma.pageUnderstandingState.findMany({
      where: { userId: studentId, resourceId },
      orderBy: { page: "asc" },
    }),
    prisma.pageUnderstandingEvent.findMany({
      where: {
        userId: studentId,
        resourceId,
        ...(dateWhere ? { recordedAt: dateWhere } : {}),
        ...(filters.page ? { page: filters.page } : {}),
      },
      orderBy: [{ recordedAt: "asc" }, { page: "asc" }],
    }),
    prisma.pageVisit.findMany({
      where: { userId: studentId, resourceId },
      select: { page: true },
    }),
    prisma.pageVisit.findMany({
      where: {
        userId: studentId,
        resourceId,
        ...(dateWhere ? { enteredAt: dateWhere } : {}),
        ...(filters.page ? { page: filters.page } : {}),
      },
      orderBy: { enteredAt: "asc" },
      select: { id: true, page: true, durationSeconds: true },
    }),
    prisma.courseDailyActivity.findMany({
      where: {
        userId: studentId,
        courseId,
        ...(dailyDateWhere ? { activityDate: dailyDateWhere } : {}),
      },
      orderBy: { activityDate: "asc" },
    }),
    prisma.resourceDailyActivity.findMany({
      where: {
        userId: studentId,
        resourceId,
        ...(dailyDateWhere ? { activityDate: dailyDateWhere } : {}),
      },
      orderBy: { activityDate: "asc" },
    }),
  ]);

  const visitedPages = distinctVisitedPages(allVisits);
  const browsingProgress = browsingProgressPercent(visitedPages.length, resource.asset.pageCount);
  const notUnderstoodPages = understandingStates.filter((state) => state.status === "NOT_UNDERSTOOD").map((state) => state.page);
  const understoodPages = understandingStates.filter((state) => state.status === "UNDERSTOOD").map((state) => state.page);
  const totalStaySeconds = filteredVisits.reduce((sum, visit) => sum + visit.durationSeconds, 0);
  const pageOccurrence = new Map<number, number>();
  const visitRows = filteredVisits.map((visit) => {
    const occurrence = (pageOccurrence.get(visit.page) ?? 0) + 1;
    pageOccurrence.set(visit.page, occurrence);
    return { id: visit.id, page: visit.page, occurrence, duration: formatDuration(visit.durationSeconds) };
  });

  const initialView = filters.recordType === "HIGHLIGHT" ? "HIGHLIGHT" : filters.recordType === "VISIT" ? "VISIT" : "NOTE";
  const query = activityQuery(filters);
  const querySuffix = query ? `?${query}` : "";

  return <div className="stack">
    <div className="page-head">
      <Link href={`/admin/submissions/course/${courseId}/resource/${resourceId}${querySuffix}`} className="subtle">←返回學生紀錄</Link>
      <h1 className="h1" style={{ marginTop: 12 }}>{enrollment.user.username} / {resource.title}</h1>
      <div className="subtle">{resource.course.semester.code} / {resource.course.name} / {enrollment.user.displayName || "未填姓名"}</div>
      <div className="subtle" style={{ marginTop: 4 }}>繳交狀態：{submission?.status === "SUBMITTED" && submission.lastSubmittedAt ? `已繳交（最近一次：${formatAppDateTime(submission.lastSubmittedAt)}）` : submission ? "草稿已自動同步，尚待繳交" : "尚未繳交，閱讀行為仍會即時記錄"}</div>
      {submission?.firstSubmittedAt && <div className="subtle" style={{ marginTop: 4 }}>首次繳交：{formatAppDateTime(submission.firstSubmittedAt)} / 最近繳交：{submission.lastSubmittedAt ? formatAppDateTime(submission.lastSubmittedAt) : "—"} / 累計繳交{submission.submissionCount}次</div>}
    </div>

    <section className="card panel">
      <div className="reading-summary-grid">
        <div className="reading-summary-item"><span>教材瀏覽進度</span><strong>{browsingProgress == null ? "—" : `${browsingProgress}%`}</strong><small>{resource.asset.pageCount ? `${visitedPages.length}/${resource.asset.pageCount}頁` : `已瀏覽${visitedPages.length}頁`}</small></div>
        <div className="reading-summary-item"><span>目前自陳不理解頁面</span><strong className={notUnderstoodPages.length ? "understanding-text-no" : ""}>{notUnderstoodPages.length}</strong><small>{pageListLabel(notUnderstoodPages)}</small></div>
        <div className="reading-summary-item"><span>目前自陳已理解頁面</span><strong>{understoodPages.length}</strong><small>{pageListLabel(understoodPages)}</small></div>
        <div className="reading-summary-item"><span>課程活動天數</span><strong>{dailyActivities.length}天</strong><small>{filterPeriodLabel(filters)}</small></div>
        <div className="reading-summary-item"><span>教材閱讀天數</span><strong>{resourceDailyActivities.length}天</strong><small>{filterPeriodLabel(filters)}</small></div>
        <div className="reading-summary-item"><span>頁面停留時間合計</span><strong>{formatDuration(totalStaySeconds)}</strong><small>依目前日期/頁碼篩選</small></div>
      </div>

      <details className="understanding-history" style={{ marginTop: 16 }} open={filters.recordType === "UNDERSTANDING"}>
        <summary>查看逐頁目前自陳理解狀態與歷史變更（{understandingEvents.length}筆歷程）</summary>
        <div className="stack" style={{ marginTop: 14 }}>
          <div className="table-wrap"><table>
            <thead><tr><th>頁碼</th><th>目前自陳狀態</th><th>最後選擇時間</th></tr></thead>
            <tbody>{understandingStates.length === 0 ? <tr><td colSpan={3} className="subtle">尚未留下理解狀態。</td></tr> : understandingStates.map((state) => <tr key={state.id}><td>P.{state.page}</td><td className={state.status === "NOT_UNDERSTOOD" ? "understanding-text-no" : "understanding-text-yes"}>{understandingLabel(state.status)}</td><td>{formatAppDateTime(state.selectedAt)}</td></tr>)}</tbody>
          </table></div>
          <div>
            <strong>歷史變更</strong>
            {understandingEvents.length === 0 ? <div className="subtle" style={{ marginTop: 8 }}>尚無歷史紀錄。</div> : <div className="understanding-event-list">{understandingEvents.map((event) => <div className="understanding-event-row" key={event.id}><span>P.{event.page}</span><strong className={event.status === "NOT_UNDERSTOOD" ? "understanding-text-no" : "understanding-text-yes"}>{understandingLabel(event.status)}</strong><span className="subtle">{formatAppDateTime(event.recordedAt)}</span></div>)}</div>}
          </div>
        </div>
      </details>

      <details className="understanding-history" style={{ marginTop: 14 }} open={filters.recordType === "DAILY_ACTIVITY" || filters.recordType === "RESOURCE_DAILY_ACTIVITY"}>
        <summary>查看活動日期</summary>
        <div style={{ marginTop: 12 }}>
          <div className="stack">
            <div><strong>課程活動日（{dailyActivities.length}天）</strong>{dailyActivities.length === 0 ? <div className="subtle">目前檢視期間內沒有課程活動日。</div> : <div className="activity-day-list">{dailyActivities.map((activity) => <span className="badge" key={activity.id}>{formatDbDateOnly(activity.activityDate)}</span>)}</div>}</div>
            <div><strong>教材閱讀日（{resourceDailyActivities.length}天）</strong>{resourceDailyActivities.length === 0 ? <div className="subtle">目前檢視期間內沒有教材閱讀日。</div> : <div className="activity-day-list">{resourceDailyActivities.map((activity) => <span className="badge" key={activity.id}>{formatDbDateOnly(activity.activityDate)}</span>)}</div>}</div>
          </div>
        </div>
      </details>
    </section>

    <div className="filter-summary"><strong>目前檢視期間：</strong>{filterPeriodLabel(filters)}<span> / 文字筆記{submission?.notes.length ?? 0}則 / PDF劃記{submission?.highlights.length ?? 0}筆 / 停留紀錄{filteredVisits.length}筆</span></div>

    <StudentReadingRecordViewer
      initialView={initialView}
      notes={(submission?.notes ?? []).map((note) => ({ id: note.id, type: note.type, page: note.page, content: note.content, recordedAt: formatAppDateTime(note.recordedAt) }))}
      highlights={(submission?.highlights ?? []).map((highlight) => {
        const geometry = highlight.geometry as Geometry;
        return { id: highlight.id, color: highlight.color, page: highlight.page, extractedText: highlight.extractedText || "", pointCount: Array.isArray(geometry.points) ? geometry.points.length : 0, recordedAt: formatAppDateTime(highlight.recordedAt) };
      })}
      visits={visitRows}
    />
  </div>;
}
