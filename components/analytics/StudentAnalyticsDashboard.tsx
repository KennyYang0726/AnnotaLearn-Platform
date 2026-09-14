import Link from "next/link";
import type { StudentCourseAnalyticsData } from "@/lib/analytics/types";
import { AnalyticsLineChart, AnalyticsProgressList } from "@/components/analytics/AnalyticsCharts";
import { formatDuration } from "@/lib/reading-activity";
import { pageListLabel } from "@/lib/reading-analytics";

export default function StudentAnalyticsDashboard({ data }: { data: StudentCourseAnalyticsData }) {
  const activeTaskTotal = data.metrics.submittedTasks + data.metrics.pendingTasks;
  return <div className="stack analytics-page">
    <div className="page-head analytics-page-head"><div><Link href={`/courses/${data.course.id}`} className="subtle">←返回課程</Link><div style={{ marginTop: 14 }}><span className="badge">{data.course.semesterCode}</span></div><h1 className="h1" style={{ marginTop: 8 }}>我的學習分析</h1><div className="subtle">{data.course.name}・這些數據用來協助你回顧閱讀歷程，不是成績或班級排名。</div></div></div>

    <section className="analytics-kpi-grid">
      <div className="card analytics-kpi"><span>平均教材瀏覽進度</span><strong>{data.metrics.averageProgress == null ? "—" : `${data.metrics.averageProgress}%`}</strong><small>各教材頁面瀏覽比例平均</small></div>
      <div className="card analytics-kpi"><span>課程活動天數</span><strong>{data.metrics.courseActiveDays}</strong><small>曾進入課程的日數</small></div>
      <div className="card analytics-kpi"><span>教材閱讀天數</span><strong>{data.metrics.resourceReadingDays}</strong><small>曾實際開啟教材的日數</small></div>
      <div className="card analytics-kpi"><span>目前閱讀任務</span><strong>{activeTaskTotal ? `${data.metrics.submittedTasks}/${activeTaskTotal}` : "—"}</strong><small>{data.metrics.pendingTasks}項尚未正式繳交{data.metrics.upcomingTasks ? `・${data.metrics.upcomingTasks}項尚未開放` : ""}</small></div>
    </section>

    <div className="analytics-grid analytics-grid-2">
      <section className="card panel analytics-panel"><div className="analytics-panel-head"><div><h2 className="h2">近30日閱讀活動</h2><p>每天曾閱讀的不同教材數，協助你查看自己的閱讀持續性。</p></div></div><AnalyticsLineChart data={data.dailyResources} label="近30日每日閱讀教材數折線圖" emptyText="近30日尚無教材閱讀活動" /></section>
      <section className="card panel analytics-panel"><div className="analytics-panel-head"><div><h2 className="h2">各教材瀏覽進度</h2><p>表示你曾造訪的不重複頁面，占教材總頁數的比例。</p></div></div><AnalyticsProgressList rows={data.resources.map((resource) => ({ id: resource.id, label: resource.title, value: resource.available ? resource.progress : null, meta: `${resource.sectionTitle ?? "未分組"}${resource.available ? "" : "・尚未開放"}` }))} maxValue={100} /></section>
    </div>

    <section className="card panel analytics-panel">
      <div className="analytics-panel-head"><div><h2 className="h2">教材回顧</h2><p>把你的教材瀏覽、停留、Annotation與自陳「我不懂」頁面放在一起，方便決定下一步要回看哪份教材。</p></div></div>
      {data.resources.length === 0 ? <div className="analytics-empty-chart">目前沒有教材。</div> : <div className="analytics-student-resource-list">{data.resources.map((resource) => <article className="analytics-student-resource" key={resource.id}>
        <div className="analytics-student-resource-main"><span className="analytics-resource-kicker">{resource.sectionTitle ?? "未分組"}</span><h3>{resource.title}</h3><div className="analytics-inline-progress analytics-student-progress"><span><i style={{ width: `${resource.progress ?? 0}%` }} /></span><strong>{resource.progress == null ? "—" : `${resource.progress}%`}</strong></div><div className="subtle">{resource.pageCount ? `${resource.visitedPages}/${resource.pageCount}頁已瀏覽` : `${resource.visitedPages}頁已瀏覽`}・閱讀{resource.readingDays}天・停留{formatDuration(resource.dwellSeconds)}</div>{resource.notUnderstoodPages.length > 0 && <div className="analytics-review-callout">你目前標示「我不懂」：{pageListLabel(resource.notUnderstoodPages)}</div>}</div>
        <div className="analytics-student-resource-side"><div><span>筆記</span><strong>{resource.noteCount}</strong></div><div><span>劃記</span><strong>{resource.highlightCount}</strong></div>{resource.readingTaskEnabled && <div><span>閱讀任務</span><strong>{resource.submitted ? (resource.submittedLate ? "逾期繳交" : "已繳交") : !resource.available ? "尚未開放" : resource.overdue ? "已逾期・可補交" : "待繳"}</strong>{resource.dueAtLabel && <small>截止{resource.dueAtLabel}</small>}</div>}{resource.available ? <Link className="btn btn-primary" href={`/courses/${data.course.id}/resources/${resource.id}`}>進入教材</Link> : <button className="btn" type="button" disabled>尚未開放</button>}</div>
      </article>)}</div>}
    </section>
  </div>;
}
