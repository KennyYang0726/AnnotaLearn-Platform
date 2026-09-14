import Link from "next/link";
import type { StudentCourseAnalyticsData } from "@/lib/analytics/types";
import { AnalyticsLineChart, AnalyticsProgressList } from "@/components/analytics/AnalyticsCharts";
import { formatDuration } from "@/lib/reading-activity";
import { pageListLabel } from "@/lib/reading-analytics";

export default function TeacherStudentAnalyticsDashboard({
  data,
  backHref,
  recordHref,
}: {
  data: StudentCourseAnalyticsData;
  backHref: string;
  recordHref: (resourceId: string) => string;
}) {
  const activeTaskTotal = data.metrics.submittedTasks + data.metrics.pendingTasks;
  return <div className="stack analytics-page">
    <div className="page-head analytics-page-head"><div><Link href={backHref} className="subtle">←返回課程學習分析</Link><div className="row" style={{ marginTop: 14 }}><span className="badge">{data.course.semesterCode}</span><span className="subtle">{data.student.username}</span></div><h1 className="h1" style={{ marginTop: 8 }}>{data.student.displayName || data.student.username}</h1><div className="subtle">{data.course.name}・學生個人學習歷程分析</div></div></div>

    <section className="analytics-kpi-grid">
      <div className="card analytics-kpi"><span>平均教材瀏覽進度</span><strong>{data.metrics.averageProgress == null ? "—" : `${data.metrics.averageProgress}%`}</strong><small>僅計目前已開放教材</small></div>
      <div className="card analytics-kpi"><span>課程活動天數</span><strong>{data.metrics.courseActiveDays}</strong><small>曾進入課程的日數</small></div>
      <div className="card analytics-kpi"><span>教材閱讀天數</span><strong>{data.metrics.resourceReadingDays}</strong><small>曾實際開啟教材的日數</small></div>
      <div className="card analytics-kpi"><span>目前閱讀任務</span><strong>{activeTaskTotal ? `${data.metrics.submittedTasks}/${activeTaskTotal}` : "—"}</strong><small>{data.metrics.pendingTasks}項待繳{data.metrics.upcomingTasks ? `・${data.metrics.upcomingTasks}項尚未開放` : ""}</small></div>
    </section>

    <div className="analytics-grid analytics-grid-2">
      <section className="card panel analytics-panel"><div className="analytics-panel-head"><div><h2 className="h2">近30日閱讀活動</h2><p>每天曾閱讀的不同教材數。</p></div></div><AnalyticsLineChart data={data.dailyResources} label="學生近30日每日閱讀教材數折線圖" emptyText="近30日尚無教材閱讀活動" /></section>
      <section className="card panel analytics-panel"><div className="analytics-panel-head"><div><h2 className="h2">各教材瀏覽進度</h2><p>尚未開放的教材不納入平均進度。</p></div></div><AnalyticsProgressList rows={data.resources.map((resource) => ({ id: resource.id, label: resource.title, value: resource.available ? resource.progress : null, meta: `${resource.sectionTitle ?? "未分組"}${resource.available ? "" : "・尚未開放"}` }))} maxValue={100} /></section>
    </div>

    <section className="card panel analytics-panel">
      <div className="analytics-panel-head"><div><h2 className="h2">教材層級紀錄</h2><p>可從摘要再進入既有原始閱讀/繳交紀錄，避免只依圖表判讀。</p></div></div>
      {data.resources.length === 0 ? <div className="analytics-empty-chart">目前沒有教材。</div> : <div className="table-wrap"><table className="analytics-table"><thead><tr><th>教材</th><th>教材瀏覽進度</th><th>閱讀天數</th><th>停留時間</th><th>筆記/劃記</th><th>目前「我不懂」</th><th>閱讀任務</th><th></th></tr></thead><tbody>{data.resources.map((resource) => <tr key={resource.id}><td><strong>{resource.title}</strong><br/><span className="subtle">{resource.sectionTitle ?? "未分組"}</span></td><td>{resource.available ? (resource.progress == null ? "—" : `${resource.progress}%`) : "尚未開放"}</td><td>{resource.readingDays}天</td><td>{formatDuration(resource.dwellSeconds)}</td><td>{resource.noteCount}/{resource.highlightCount}</td><td>{pageListLabel(resource.notUnderstoodPages)}</td><td>{resource.readingTaskEnabled ? (resource.submitted ? (resource.submittedLate ? "逾期繳交" : "已繳交") : !resource.available ? "尚未開放" : resource.overdue ? "已逾期・可補交" : "待繳") : "—"}{resource.dueAtLabel && <><br/><span className="subtle">截止{resource.dueAtLabel}</span></>}</td><td>{resource.available ? <Link className="btn btn-outline btn-compact btn-nowrap" href={recordHref(resource.id)}>原始紀錄</Link> : "—"}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
