import Link from "next/link";
import type { CourseAnalyticsData } from "@/lib/analytics/types";
import { AnalyticsLineChart, AnalyticsProgressList, AnalyticsStackedBars } from "@/components/analytics/AnalyticsCharts";
import type { StackedSeries } from "@/components/analytics/AnalyticsCharts";
import AnalyticsCsvExportButton from "@/components/analytics/AnalyticsCsvExportButton";
import { formatDuration } from "@/lib/reading-activity";

export default function CourseAnalyticsDashboard({
  data,
  resourceBasePath,
  studentBasePath,
  backHref,
  backLabel,
}: {
  data: CourseAnalyticsData;
  resourceBasePath: string;
  studentBasePath: string;
  backHref: string;
  backLabel: string;
}) {
  const taskSeries: StackedSeries[] = [
    { key: "onTime", label: "已繳交", tone: "success" },
    { key: "late", label: "逾期繳交", tone: "warning" },
    { key: "pending", label: "待繳", tone: "neutral" },
    { key: "overdue", label: "逾期未繳", tone: "danger" },
    { key: "upcoming", label: "尚未開放", tone: "muted" },
  ];
  const dailyReaderCsvRows = data.dailyReaders.map((point) => ({
    date: point.date,
    readers: point.value,
  }));

  return <div className="stack analytics-page">
    <div className="page-head analytics-page-head">
      <div><Link href={backHref} className="subtle">←{backLabel}</Link><div className="row" style={{ marginTop: 14 }}><span className="badge">{data.course.semesterCode}</span><span className="subtle">{data.course.courseCode}</span></div><h1 className="h1" style={{ marginTop: 8 }}>{data.course.name}</h1><div className="subtle">學習分析儀表板・資料以目前平台已記錄的學習歷程為基礎</div></div>
    </div>

    <section className="analytics-kpi-grid">
      <div className="card analytics-kpi"><span>修課學生</span><strong>{data.metrics.enrolledStudents}</strong><small>目前課程名單</small></div>
      <div className="card analytics-kpi"><span>已有教材閱讀紀錄</span><strong>{data.metrics.readers}</strong><small>至少產生一次PageVisit</small></div>
      <div className="card analytics-kpi"><span>平均教材瀏覽進度</span><strong>{data.metrics.averageProgress == null ? "—" : `${data.metrics.averageProgress}%`}</strong><small>學生×教材之頁面瀏覽比例平均</small></div>
      <div className="card analytics-kpi"><span>待繳閱讀任務</span><strong>{data.metrics.pendingTasks}</strong><small>已開放且尚未正式繳交的人次</small></div>
    </section>

    <div className="analytics-grid analytics-grid-2">
      <section className="card panel analytics-panel">
        <div className="analytics-panel-head"><div><h2 className="h2">近30日教材閱讀活動</h2><p>每日曾開啟至少一份教材的不同學生數。</p></div></div>
        <AnalyticsLineChart data={data.dailyReaders} label="近30日每日教材閱讀學生數折線圖" emptyText="近30日尚無教材閱讀活動" />
        <div className="analytics-panel-footer"><AnalyticsCsvExportButton filename={`學習分析_${data.course.courseCode}_近30日教材閱讀活動.csv`} columns={[{ key: "date", header: "日期" }, { key: "readers", header: "閱讀學生數" }]} rows={dailyReaderCsvRows} /></div>
      </section>
      <section className="card panel analytics-panel">
        <div className="analytics-panel-head"><div><h2 className="h2">課程單元教材瀏覽進度</h2><p>以各單元內「學生×教材」的教材瀏覽進度平均呈現。</p></div></div>
        <AnalyticsProgressList rows={data.sections.map((section) => ({ id: section.id, label: section.title, value: section.averageProgress, meta: `${section.resourceCount}份教材・${section.readerCount}位學生曾閱讀` }))} maxValue={100} />
      </section>
    </div>

    <section className="card panel analytics-panel">
      <div className="analytics-panel-head"><div><h2 className="h2">閱讀任務提交狀態</h2><p>截止時間只用於標記準時/逾期，不會把逾期學生鎖在教材外。</p></div></div>
      {data.tasks.length ? <AnalyticsStackedBars rows={data.tasks.map((task) => ({ id: task.id, label: task.title, total: task.total, meta: [task.sectionTitle, task.dueAtLabel ? `截止${task.dueAtLabel}` : "未設定截止"].filter(Boolean).join("・"), values: { onTime: task.onTime, late: task.late, pending: task.pending, overdue: task.overdue, upcoming: task.upcoming } }))} series={taskSeries} /> : <div className="analytics-empty-chart">目前沒有啟用閱讀任務的教材。</div>}
    </section>

    <section className="card panel analytics-panel">
      <div className="analytics-panel-head"><div><h2 className="h2">教材分析入口</h2><p>先比較教材層級，再鑽取到頁面停留、自陳理解與Annotation分布。</p></div></div>
      {data.resources.length === 0 ? <div className="analytics-empty-chart">目前沒有教材。</div> : <div className="analytics-resource-grid">
        {data.resources.map((resource) => <article className="analytics-resource-card" key={resource.id}>
          <div><span className="analytics-resource-kicker">{resource.sectionTitle ?? "未分組"}</span><h3>{resource.title}</h3><div className="subtle">{resource.pageCount ? `${resource.pageCount}頁` : "頁數未記錄"}{resource.readingTaskEnabled ? "・閱讀任務" : ""}</div></div>
          <div className="analytics-resource-stats"><span>曾閱讀<strong>{resource.readerCount}</strong></span><span>平均瀏覽進度<strong>{resource.available ? (resource.averageProgress == null ? "—" : `${resource.averageProgress}%`) : "尚未開放"}</strong></span><span>已繳交<strong>{resource.submittedCount}</strong></span></div>
          <Link className="btn btn-primary" href={`${resourceBasePath}/${resource.id}`}>查看頁面分析</Link>
        </article>)}
      </div>}
    </section>

    <section className="card panel analytics-panel">
      <div className="analytics-panel-head"><div><h2 className="h2">學生概況</h2><p>這裡呈現可直接觀察的行為指標，不產生「投入度分數」或班級排名。</p></div></div>
      {data.students.length === 0 ? <div className="analytics-empty-chart">目前沒有學生。</div> : <div className="table-wrap"><table className="analytics-table"><thead><tr><th>學生</th><th>平均教材瀏覽進度</th><th>課程活動天數</th><th>教材閱讀天數</th><th>頁面停留時間</th><th>筆記/劃記</th><th>閱讀任務</th><th></th></tr></thead><tbody>{data.students.map((student) => <tr key={student.id}><td><Link href={`${studentBasePath}/${student.id}`}><strong>{student.username}</strong><br/><span className="subtle">{student.displayName || "—"}</span></Link></td><td><div className="analytics-inline-progress"><span><i style={{ width: `${student.averageProgress ?? 0}%` }} /></span><strong>{student.averageProgress == null ? "—" : `${student.averageProgress}%`}</strong></div></td><td>{student.courseActiveDays}天</td><td>{student.resourceReadingDays}天</td><td>{formatDuration(student.dwellSeconds)}</td><td>{student.noteCount}/{student.highlightCount}</td><td>{student.taskCount ? `${student.submittedTasks}/${student.taskCount}` : "—"}</td><td><Link className="btn btn-outline btn-compact btn-nowrap" href={`${studentBasePath}/${student.id}`}>查看</Link></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
