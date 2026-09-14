import Link from "next/link";
import type { ResourceAnalyticsData } from "@/lib/analytics/types";
import { AnalyticsHorizontalBarChart, AnalyticsStackedBars } from "@/components/analytics/AnalyticsCharts";
import type { StackedSeries } from "@/components/analytics/AnalyticsCharts";
import AnalyticsCsvExportButton from "@/components/analytics/AnalyticsCsvExportButton";
import { formatDuration } from "@/lib/reading-activity";

export default function ResourceAnalyticsDashboard({
  data,
  backHref,
  highlightHref,
}: {
  data: ResourceAnalyticsData;
  backHref: string;
  highlightHref: string;
}) {
  const visiblePages = data.pages.filter((page) => page.readers || page.understood || page.notUnderstood || page.importantHighlights || page.questionHighlights || page.keyPointNotes || page.questionNotes);
  const dwellRows = visiblePages.map((page) => ({
    id: String(page.page),
    label: `P.${page.page}`,
    value: page.averageDwellSeconds,
    meta: `${page.readers}位學生・${page.visitCount}次造訪`,
  }));
  const dwellCsvRows = visiblePages.map((page) => ({
    page: page.page,
    averageDwellSeconds: page.averageDwellSeconds,
    readers: page.readers,
    visitCount: page.visitCount,
  }));
  const understandingRows = visiblePages.map((page) => ({
    id: String(page.page),
    label: `P.${page.page}`,
    total: page.understood + page.notUnderstood,
    values: { understood: page.understood, notUnderstood: page.notUnderstood },
  }));
  const understandingCsvRows = visiblePages
    .filter((page) => page.understood + page.notUnderstood > 0)
    .map((page) => ({
      page: page.page,
      understood: page.understood,
      notUnderstood: page.notUnderstood,
      total: page.understood + page.notUnderstood,
    }));
  const annotationRows = visiblePages.map((page) => ({
    id: String(page.page),
    label: `P.${page.page}`,
    total: page.importantHighlights + page.questionHighlights + page.keyPointNotes + page.questionNotes,
    values: {
      importantHighlights: page.importantHighlights,
      questionHighlights: page.questionHighlights,
      keyPointNotes: page.keyPointNotes,
      questionNotes: page.questionNotes,
    },
  }));
  const annotationCsvRows = visiblePages
    .filter((page) => page.importantHighlights + page.questionHighlights + page.keyPointNotes + page.questionNotes > 0)
    .map((page) => ({
      page: page.page,
      importantHighlights: page.importantHighlights,
      questionHighlights: page.questionHighlights,
      keyPointNotes: page.keyPointNotes,
      questionNotes: page.questionNotes,
      total: page.importantHighlights + page.questionHighlights + page.keyPointNotes + page.questionNotes,
    }));
  const annotationSeries: StackedSeries[] = [
    { key: "importantHighlights", label: "重點劃記", tone: "important" },
    { key: "questionHighlights", label: "疑問劃記", tone: "question" },
    { key: "keyPointNotes", label: "重點筆記", tone: "importantNote" },
    { key: "questionNotes", label: "疑問筆記", tone: "questionNote" },
  ];

  return <div className="stack analytics-page">
    <div className="page-head analytics-page-head">
      <div><Link href={backHref} className="subtle">←返回課程學習分析</Link><div className="row" style={{ marginTop: 14 }}><span className="badge">{data.course.semesterCode}</span>{data.resource.sectionTitle && <span className="badge">{data.resource.sectionTitle}</span>}</div><h1 className="h1" style={{ marginTop: 8 }}>{data.resource.title}</h1><div className="subtle">{data.resource.originalName}{data.resource.pageCount ? `・${data.resource.pageCount}頁` : ""}</div></div>
      <Link className="btn btn-outline" href={highlightHref}>查看教材劃記疊圖</Link>
    </div>

    <section className="analytics-kpi-grid analytics-kpi-grid-5">
      <div className="card analytics-kpi"><span>曾閱讀學生</span><strong>{data.metrics.readers}</strong><small>至少一筆PageVisit</small></div>
      <div className="card analytics-kpi"><span>平均教材瀏覽進度</span><strong>{data.metrics.averageProgress == null ? "—" : `${data.metrics.averageProgress}%`}</strong><small>全體修課學生平均</small></div>
      <div className="card analytics-kpi"><span>累計頁面停留</span><strong className="analytics-kpi-time">{formatDuration(data.metrics.totalDwellSeconds)}</strong><small>有效前景停留時間加總</small></div>
      <div className="card analytics-kpi"><span>目前筆記/劃記</span><strong>{data.metrics.noteCount}/{data.metrics.highlightCount}</strong><small>目前仍存在的Annotation</small></div>
      <div className="card analytics-kpi"><span>「我不懂」回報</span><strong>{data.metrics.notUnderstoodResponses}</strong><small>目前自陳理解狀態</small></div>
    </section>

    <div className="analytics-grid analytics-grid-2">
      <section className="card panel analytics-panel">
        <div className="analytics-panel-head"><div><h2 className="h2">各頁平均停留時間</h2><p>每頁所有停留秒數÷曾造訪該頁的不同學生數，重複造訪仍計入總停留。</p></div></div>
        <AnalyticsHorizontalBarChart rows={dwellRows} valueSuffix="秒" emptyText="目前沒有頁面停留紀錄" />
        <div className="analytics-panel-footer"><AnalyticsCsvExportButton filename={`學習分析_${data.resource.title}_各頁平均停留時間.csv`} columns={[{ key: "page", header: "頁碼" }, { key: "averageDwellSeconds", header: "平均停留時間(秒)" }, { key: "readers", header: "閱讀學生數" }, { key: "visitCount", header: "造訪次數" }]} rows={dwellCsvRows} /></div>
      </section>
      <section className="card panel analytics-panel">
        <div className="analytics-panel-head"><div><h2 className="h2">各頁目前自陳理解狀態</h2><p>只呈現學生主動選擇的「我懂了/我不懂」，不等同客觀理解程度。</p></div></div>
        <AnalyticsStackedBars rows={understandingRows} series={[{ key: "understood", label: "我懂了", tone: "success" }, { key: "notUnderstood", label: "我不懂", tone: "danger" }]} emptyText="目前沒有自陳理解狀態" />
        <div className="analytics-panel-footer"><AnalyticsCsvExportButton filename={`學習分析_${data.resource.title}_各頁目前自陳理解狀態.csv`} columns={[{ key: "page", header: "頁碼" }, { key: "understood", header: "我懂了(人數)" }, { key: "notUnderstood", header: "我不懂(人數)" }, { key: "total", header: "回報總數" }]} rows={understandingCsvRows} /></div>
      </section>
    </div>

    <section className="card panel analytics-panel">
      <div className="analytics-panel-head"><div><h2 className="h2">各頁Annotation分布</h2><p>呈現目前仍存在的重點/疑問型劃記與筆記，事件歷程另保留於研究資料層。</p></div></div>
      <AnalyticsStackedBars rows={annotationRows} series={annotationSeries} emptyText="目前沒有Annotation" />
      <div className="analytics-panel-footer"><AnalyticsCsvExportButton filename={`學習分析_${data.resource.title}_各頁Annotation分布.csv`} columns={[{ key: "page", header: "頁碼" }, { key: "importantHighlights", header: "重點劃記" }, { key: "questionHighlights", header: "疑問劃記" }, { key: "keyPointNotes", header: "重點筆記" }, { key: "questionNotes", header: "疑問筆記" }, { key: "total", header: "Annotation總數" }]} rows={annotationCsvRows} /></div>
    </section>

    <section className="card panel analytics-panel">
      <div className="analytics-panel-head"><div><h2 className="h2">頁面綜合分析</h2><p>將不同可觀察行為並列，不合成單一「困難度」或「投入度」分數。</p></div></div>
      {visiblePages.length === 0 ? <div className="analytics-empty-chart">目前沒有可呈現的頁面資料。</div> : <div className="table-wrap"><table className="analytics-table analytics-page-matrix"><thead><tr><th>頁碼</th><th>閱讀學生</th><th>平均停留</th><th>我懂了</th><th>我不懂</th><th>重點劃記</th><th>疑問劃記</th><th>重點筆記</th><th>疑問筆記</th></tr></thead><tbody>{visiblePages.map((page) => <tr key={page.page}><td><strong>P.{page.page}</strong></td><td>{page.readers}</td><td>{formatDuration(page.averageDwellSeconds)}</td><td>{page.understood}</td><td className={page.notUnderstood ? "analytics-attention-cell" : undefined}>{page.notUnderstood}</td><td>{page.importantHighlights}</td><td className={page.questionHighlights ? "analytics-attention-cell" : undefined}>{page.questionHighlights}</td><td>{page.keyPointNotes}</td><td className={page.questionNotes ? "analytics-attention-cell" : undefined}>{page.questionNotes}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
