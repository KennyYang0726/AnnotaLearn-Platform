import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  activityDateWhere,
  activityQuery,
  filterPeriodLabel,
  formatTaipeiDate,
  latestDate,
  parseActivityFilters,
  recordedAtWhere,
} from "@/lib/activity-filter";
import { completionPercent, distinctVisitedPages, pageListLabel } from "@/lib/reading-analytics";
import { formatDuration } from "@/lib/reading-activity";

export default async function SubmissionResourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; resourceId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { courseId, resourceId } = await params;
  const filters = parseActivityFilters(await searchParams);
  const dateWhere = recordedAtWhere(filters);
  const dailyDateWhere = activityDateWhere(filters);

  const resource = await prisma.courseResource.findFirst({
    where: { id: resourceId, courseId },
    include: {
      asset: true,
      course: {
        include: {
          semester: true,
          enrollments: { include: { user: true } },
        },
      },
    },
  });
  if (!resource) notFound();

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
  const visitWhere = {
    resourceId,
    userId: { in: userIds },
    ...(dateWhere ? { enteredAt: dateWhere } : {}),
    ...(filters.page ? { page: filters.page } : {}),
  };

  const [submissions, understandingStates, understandingEvents, allVisits, filteredVisits, dailyActivities] = await Promise.all([
    prisma.readingSubmission.findMany({
      where: { resourceId, userId: { in: userIds } },
      include: {
        notes: { where: noteWhere, select: { id: true, page: true, recordedAt: true } },
        highlights: { where: highlightWhere, select: { id: true, page: true, recordedAt: true } },
      },
    }),
    prisma.pageUnderstandingState.findMany({
      where: { resourceId, userId: { in: userIds } },
      select: { userId: true, page: true, status: true, selectedAt: true },
      orderBy: [{ userId: "asc" }, { page: "asc" }],
    }),
    prisma.pageUnderstandingEvent.findMany({
      where: {
        resourceId,
        userId: { in: userIds },
        ...(dateWhere ? { recordedAt: dateWhere } : {}),
        ...(filters.page ? { page: filters.page } : {}),
      },
      select: { userId: true, page: true, status: true, recordedAt: true },
    }),
    prisma.pageVisit.findMany({
      where: { resourceId, userId: { in: userIds } },
      select: { userId: true, page: true },
    }),
    prisma.pageVisit.findMany({
      where: visitWhere,
      select: { userId: true, page: true, durationSeconds: true, enteredAt: true },
      orderBy: { enteredAt: "asc" },
    }),
    prisma.courseDailyActivity.findMany({
      where: {
        courseId,
        userId: { in: userIds },
        ...(dailyDateWhere ? { activityDate: dailyDateWhere } : {}),
      },
      select: { userId: true, activityDate: true, lastActivityAt: true },
      orderBy: { activityDate: "asc" },
    }),
  ]);

  const submissionMap = new Map(submissions.map((submission) => [submission.userId, submission]));
  const statesByUser = new Map<string, typeof understandingStates>();
  const eventsByUser = new Map<string, typeof understandingEvents>();
  const allVisitsByUser = new Map<string, typeof allVisits>();
  const visitsByUser = new Map<string, typeof filteredVisits>();
  const dailyByUser = new Map<string, typeof dailyActivities>();

  for (const state of understandingStates) statesByUser.set(state.userId, [...(statesByUser.get(state.userId) ?? []), state]);
  for (const event of understandingEvents) eventsByUser.set(event.userId, [...(eventsByUser.get(event.userId) ?? []), event]);
  for (const visit of allVisits) allVisitsByUser.set(visit.userId, [...(allVisitsByUser.get(visit.userId) ?? []), visit]);
  for (const visit of filteredVisits) visitsByUser.set(visit.userId, [...(visitsByUser.get(visit.userId) ?? []), visit]);
  for (const activity of dailyActivities) dailyByUser.set(activity.userId, [...(dailyByUser.get(activity.userId) ?? []), activity]);

  const studentKeyword = filters.student.toLocaleLowerCase("zh-TW");
  const students = [...resource.course.enrollments]
    .sort((a, b) => a.user.username.localeCompare(b.user.username))
    .map((enrollment) => {
      const submission = submissionMap.get(enrollment.userId);
      const states = statesByUser.get(enrollment.userId) ?? [];
      const events = eventsByUser.get(enrollment.userId) ?? [];
      const visitsAll = allVisitsByUser.get(enrollment.userId) ?? [];
      const visits = visitsByUser.get(enrollment.userId) ?? [];
      const daily = dailyByUser.get(enrollment.userId) ?? [];
      const visitedPages = distinctVisitedPages(visitsAll);
      const completion = completionPercent(visitedPages.length, resource.asset.pageCount);
      const notUnderstoodPages = states.filter((state) => state.status === "NOT_UNDERSTOOD").map((state) => state.page);
      const understoodPages = states.filter((state) => state.status === "UNDERSTOOD").map((state) => state.page);
      const totalDuration = visits.reduce((sum, visit) => sum + visit.durationSeconds, 0);
      const latest = latestDate([
        ...(submission?.notes.map((note) => note.recordedAt) ?? []),
        ...(submission?.highlights.map((highlight) => highlight.recordedAt) ?? []),
        ...events.map((event) => event.recordedAt),
        ...visits.map((visit) => visit.enteredAt),
        ...daily.map((activity) => activity.lastActivityAt),
      ]);
      return {
        enrollment,
        submission,
        states,
        events,
        visits,
        daily,
        visitedPages,
        completion,
        notUnderstoodPages,
        understoodPages,
        totalDuration,
        latest,
      };
    })
    .filter(({ enrollment }) =>
      !studentKeyword || `${enrollment.user.username} ${enrollment.user.displayName ?? ""}`.toLocaleLowerCase("zh-TW").includes(studentKeyword),
    )
    .filter(({ states, notUnderstoodPages, understoodPages }) => {
      if (filters.understanding === "ALL") return true;
      if (filters.page) {
        const state = states.find((item) => item.page === filters.page);
        if (filters.understanding === "UNSET") return !state;
        return state?.status === filters.understanding;
      }
      if (filters.understanding === "UNDERSTOOD") return understoodPages.length > 0;
      if (filters.understanding === "NOT_UNDERSTOOD") return notUnderstoodPages.length > 0;
      if (!resource.asset.pageCount) return states.length === 0;
      return states.length < resource.asset.pageCount;
    })
    .filter(({ visitedPages, completion }) => {
      if (filters.completion === "ALL") return true;
      if (filters.completion === "NOT_STARTED") return visitedPages.length === 0;
      if (filters.completion === "COMPLETE") return completion === 100;
      return visitedPages.length > 0 && completion !== 100;
    })
    .filter(({ submission, events, visits, daily }) => {
      const notes = submission?.notes ?? [];
      const highlights = submission?.highlights ?? [];
      if (filters.recordType === "NOTE") return notes.length > 0;
      if (filters.recordType === "HIGHLIGHT") return highlights.length > 0;
      if (filters.recordType === "UNDERSTANDING") return events.length > 0;
      if (filters.recordType === "VISIT") return visits.length > 0;
      if (filters.recordType === "DAILY_ACTIVITY") return daily.length > 0;

      const eventFilterActive = Boolean(filters.from || filters.to || filters.noteType !== "ALL" || filters.highlightColor !== "ALL" || filters.page);
      if (!eventFilterActive) return true;
      if (filters.noteType !== "ALL") return notes.length > 0;
      if (filters.highlightColor !== "ALL") return highlights.length > 0;
      if (filters.page) return notes.length + highlights.length + events.length + visits.length > 0;
      return notes.length + highlights.length + events.length + visits.length + daily.length > 0;
    });

  const query = activityQuery(filters);
  const querySuffix = query ? `?${query}` : "";

  return <div className="stack">
    <div className="page-head">
      <Link href={`/admin/submissions/course/${courseId}`} className="subtle">←返回教材列表</Link>
      <h1 className="h1" style={{ marginTop: 14 }}>{resource.title}</h1>
      <div className="subtle">{resource.course.semester.code} / {resource.course.name} / {resource.asset.originalName}</div>
    </div>

    <section className="card panel activity-filter-panel">
      <form className="activity-filter-grid" method="get">
        <label>起始日期<input type="date" name="from" defaultValue={filters.from} /></label>
        <label>結束日期<input type="date" name="to" defaultValue={filters.to} /></label>
        <label>紀錄類型<select name="recordType" defaultValue={filters.recordType}>
          <option value="ALL">全部</option><option value="NOTE">文字筆記</option><option value="HIGHLIGHT">螢光筆劃記</option><option value="UNDERSTANDING">理解狀態歷程</option><option value="VISIT">停留時間紀錄</option><option value="DAILY_ACTIVITY">學習活動日</option>
        </select></label>
        <label>最終理解狀態<select name="understanding" defaultValue={filters.understanding}>
          <option value="ALL">全部</option><option value="UNDERSTOOD">有「我懂了」頁面</option><option value="NOT_UNDERSTOOD">有「我不懂」頁面</option><option value="UNSET">有尚未選擇頁面</option>
        </select></label>
        <label>閱讀完成率<select name="completion" defaultValue={filters.completion}>
          <option value="ALL">全部</option><option value="COMPLETE">100%完成</option><option value="INCOMPLETE">已開始但未完成</option><option value="NOT_STARTED">尚未開始</option>
        </select></label>
        <label>頁碼<input type="number" name="page" min={1} defaultValue={filters.page ?? ""} placeholder="全部頁面" /></label>
        <label>筆記分類<select name="noteType" defaultValue={filters.noteType}><option value="ALL">全部</option><option value="KEY_POINT">重點</option><option value="QUESTION">盲點提問</option></select></label>
        <label>螢光筆顏色<select name="highlightColor" defaultValue={filters.highlightColor}><option value="ALL">全部</option><option value="RED">紅色重點</option><option value="YELLOW">黃色疑問</option></select></label>
        <label className="activity-filter-student">學生<input name="student" defaultValue={filters.student} placeholder="學號或姓名" /></label>
        <div className="activity-filter-actions"><button className="btn btn-primary" type="submit">套用篩選</button><Link className="btn btn-outline" href={`/admin/submissions/course/${courseId}/resource/${resourceId}`}>清除篩選</Link></div>
      </form>
      <div className="filter-summary"><strong>篩選期間：</strong>{filterPeriodLabel(filters)}<span> / 顯示{students.length}位學生</span><span> / 活動日以Asia/Taipei日界線計算</span></div>
    </section>

    <section className="card panel">
      <div className="between" style={{ marginBottom: 14 }}>
        <h2 className="h2" style={{ margin: 0 }}>學生紀錄</h2>
        <a className="btn btn-outline btn-nowrap" href={`/api/admin/submissions/resources/${resource.id}/export${querySuffix}`}>匯出CSV</a>
      </div>
      {students.length === 0 ? <div className="subtle">目前沒有符合篩選條件的學生紀錄。</div> : <div className="table-wrap"><table>
        <thead><tr><th>學號</th><th>姓名</th><th>繳交</th><th>完成率</th><th>已閱讀</th><th>不理解頁面</th><th>學習活動天數</th><th>停留時間</th><th>筆記/劃記</th><th>最近活動</th><th></th></tr></thead>
        <tbody>{students.map(({ enrollment, submission, visitedPages, completion, notUnderstoodPages, daily, totalDuration, latest }) => <tr key={enrollment.userId}>
          <td><strong>{enrollment.user.username}</strong></td>
          <td>{enrollment.user.displayName || "—"}</td>
          <td>{submission ? <span className="status-submitted">已繳交</span> : <span className="status-pending">尚未繳交</span>}</td>
          <td><strong>{completion == null ? "—" : `${completion}%`}</strong></td>
          <td>{resource.asset.pageCount ? `${visitedPages.length}/${resource.asset.pageCount}頁` : `${visitedPages.length}頁`}</td>
          <td className={notUnderstoodPages.length ? "understanding-text-no" : "subtle"}>{pageListLabel(notUnderstoodPages)}</td>
          <td>{daily.length}天</td>
          <td>{formatDuration(totalDuration)}</td>
          <td>{submission?.notes.length ?? 0} / {submission?.highlights.length ?? 0}</td>
          <td>{latest ? formatTaipeiDate(latest) : "—"}</td>
          <td><Link className="btn btn-primary btn-compact btn-nowrap" href={`/admin/submissions/course/${courseId}/resource/${resourceId}/student/${enrollment.userId}${querySuffix}`}>查看紀錄</Link></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </div>;
}
