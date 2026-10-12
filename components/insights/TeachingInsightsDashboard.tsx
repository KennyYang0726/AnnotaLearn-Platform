import Link from "next/link";
import { formatDuration } from "@/lib/reading-activity";
import type { TeachingInsightsData, TeachingInsightView } from "@/lib/insights/types";

function percent(value: number | null) {
  return value == null ? "—" : `${value}%`;
}

function ratio(value: number) {
  return value ? value.toFixed(2) : "0.00";
}

function viewHref(courseId: string, view: TeachingInsightView) {
  return `/admin/insights/courses/${courseId}?view=${view}`;
}

function ParticipationView({ data }: { data: TeachingInsightsData }) {
  return <>
    {!data.participation.comparable && <section className="insight-notice insight-notice-warning">
      目前修課學生少於{data.participation.minimumComparableStudents}人，班內相對分布不穩定，因此不進行「較低、較高區間」分類。仍可查看個別學生的原始行為指標。
    </section>}

    <section className="insight-group-grid">
      {data.participation.groups.map((group) => <article className={`card insight-group-card insight-group-${group.key}`} key={group.key}>
        <div className="insight-group-card-head"><div><span className="insight-group-kicker">行為群組</span><h2>{group.title}</h2></div><strong>{group.students.length}人</strong></div>
        <p>{group.description}</p>
        <small>{group.method}</small>
      </article>)}
    </section>

    {data.participation.groups.map((group) => group.students.length > 0 && <section className="card panel insight-panel" key={group.key}>
      <div className="insight-panel-head"><div><h2 className="h2">{group.title}</h2><p>{group.description}</p></div><span className="badge">{group.students.length}人</span></div>
      <div className="table-wrap"><table className="analytics-table insight-table"><thead><tr><th>學生</th><th>活動天數</th><th>教材涵蓋</th><th>頁面涵蓋</th><th>總停留</th><th>每頁停留</th><th>回訪指標</th><th>Annotation</th><th>任務完成</th><th></th></tr></thead><tbody>
        {group.students.map((student) => <tr key={student.id}><td><strong>{student.username}</strong><br/><span className="subtle">{student.displayName || "—"}</span></td><td>{student.activeDays}天</td><td>{student.resourceCoveragePercent}%</td><td>{percent(student.pageCoveragePercent)}</td><td>{formatDuration(student.dwellSeconds)}</td><td>{formatDuration(student.dwellPerPageSeconds)}</td><td>{ratio(student.revisitRatio)}</td><td>{student.annotationCount}</td><td>{percent(student.taskCompletionPercent)}</td><td><Link className="btn btn-outline btn-compact btn-nowrap" href={`/admin/analytics/courses/${data.course.id}/students/${student.id}`}>查看學習分析</Link></td></tr>)}
      </tbody></table></div>
    </section>)}

    <details className="card panel insight-method">
      <summary>分析方法與解讀限制</summary>
      <div className="insight-method-body">
        <p>本分析使用平台可直接觀察的閱讀歷程，包括活動天數、教材涵蓋、頁面涵蓋、停留時間、頁面回訪、Annotation與閱讀任務完成情況。群組採班內相對分布進行探索性分類，不建立「投入度分數」。</p>
        <p>「閱讀參與較少」只代表多項可觀察行為位於班級較低區間，不等同於低動機、不認真或學習能力較差。教師仍需搭配課堂表現、作業與學生實際情境判斷。</p>
      </div>
    </details>
  </>;
}

function DifficultyView({ data }: { data: TeachingInsightsData }) {
  return <>
    <section className="analytics-kpi-grid insight-kpi-grid-3">
      <div className="card analytics-kpi insight-kpi-danger"><span>需優先關注</span><strong>{data.difficulty.counts.priority}</strong><small>同時出現直接理解線索與閱讀行為線索，或出現兩類直接線索</small></div>
      <div className="card analytics-kpi insight-kpi-warning"><span>具有部分線索</span><strong>{data.difficulty.counts.partial}</strong><small>目前至少出現一類理解或閱讀行為線索</small></div>
      <div className="card analytics-kpi"><span>目前無明顯線索</span><strong>{data.difficulty.counts.none}</strong><small>不代表沒有學習困難，只代表平台目前沒有觀察到本分析採用的線索</small></div>
    </section>

    <section className="card panel insight-panel">
      <div className="insight-panel-head"><div><h2 className="h2">學生閱讀困難線索</h2><p>優先使用學生主動標示的「我不懂」與疑問Annotation，再搭配較長停留與較多重複閱讀作為輔助行為線索。</p></div></div>
      {data.difficulty.rows.length === 0 ? <div className="analytics-empty-chart">目前沒有學生資料。</div> : <div className="table-wrap"><table className="analytics-table insight-table"><thead><tr><th>學生</th><th>狀態</th><th>觀察到的線索</th><th>頁面涵蓋</th><th>活動天數</th><th></th></tr></thead><tbody>
        {data.difficulty.rows.map((student) => <tr key={student.id}><td><strong>{student.username}</strong><br/><span className="subtle">{student.displayName || "—"}</span></td><td><span className={`insight-status insight-status-${student.status}`}>{student.statusLabel}</span></td><td>{student.evidence.length ? <div className="insight-signal-list">{student.evidence.map((item) => <span key={item}>{item}</span>)}</div> : <span className="subtle">目前未觀察到本分析採用的線索</span>}</td><td>{percent(student.pageCoveragePercent)}</td><td>{student.activeDays}天</td><td><Link className="btn btn-outline btn-compact btn-nowrap" href={`/admin/analytics/courses/${data.course.id}/students/${student.id}`}>查看學習分析</Link></td></tr>)}
      </tbody></table></div>}
    </section>

    <details className="card panel insight-method">
      <summary>分析方法與解讀限制</summary>
      <div className="insight-method-body">
        <p>直接線索包含目前自陳理解狀態為「我不懂」的頁面，以及目前保留的疑問筆記或疑問劃記。行為線索包含同一頁相對較長的停留時間，以及班內相對較高的重複閱讀比例。</p>
        <p>這裡只稱為「困難線索」，不把長時間停留或重讀直接視為理解失敗。重讀也可能是有效的閱讀策略，因此沒有學生主動回報時，單一行為線索不會被標記為「需優先關注」。</p>
      </div>
    </details>
  </>;
}

function MaterialsView({ data }: { data: TeachingInsightsData }) {
  const resourcesWithSignals = data.materials.resources.filter((resource) => resource.pages.length > 0);
  return <>
    <section className="analytics-kpi-grid insight-kpi-grid-3">
      <div className="card analytics-kpi"><span>分析教材</span><strong>{data.coverage.analyzedResources}</strong><small>目前已開放並納入分析的教材</small></div>
      <div className="card analytics-kpi"><span>具有關注線索的教材</span><strong>{resourcesWithSignals.length}</strong><small>至少有一頁出現相對較高的停留、回訪、不理解或疑問Annotation</small></div>
      <div className="card analytics-kpi insight-kpi-warning"><span>多重線索頁面</span><strong>{data.materials.totalMultiSignalPages}</strong><small>同一頁同時出現至少兩類關注線索</small></div>
    </section>

    {data.materials.resources.length === 0 ? <section className="card panel"><div className="analytics-empty-chart">目前沒有可分析的教材。</div></section> : <section className="insight-material-list">
      {data.materials.resources.map((resource) => <article className="card panel insight-material-card" key={resource.id}>
        <div className="insight-material-head"><div><span className="analytics-resource-kicker">{resource.sectionTitle ?? "未分組"}</span><h2 className="h2">{resource.title}</h2><div className="subtle">{resource.pageCount ? `${resource.pageCount}頁` : "頁數未記錄"}，{resource.readerCount}位學生曾閱讀</div></div><div className="insight-material-actions"><span className="badge">多重線索{resource.multiSignalPageCount}頁</span><Link className="btn btn-outline btn-compact" href={`/admin/analytics/courses/${data.course.id}/resources/${resource.id}`}>頁面學習分析</Link><Link className="btn btn-outline btn-compact" href={`/admin/highlights/${data.course.id}/${resource.id}`}>劃記總覽</Link></div></div>
        {resource.pages.length === 0 ? <div className="insight-no-signal">目前沒有形成班內相對突出的頁面線索。</div> : <div className="insight-page-grid">{resource.pages.slice(0, 12).map((page) => <div className={`insight-page-card ${page.signals.length >= 2 ? "insight-page-card-multi" : ""}`} key={page.page}>
          <div className="insight-page-card-head"><strong>P.{page.page}</strong><span>{page.signals.length}項線索</span></div>
          <div className="insight-page-signals">{page.signals.map((signal) => <span key={signal}>{signal}</span>)}</div>
          <dl><div><dt>閱讀學生</dt><dd>{page.readers}人</dd></div><div><dt>平均停留</dt><dd>{formatDuration(page.averageDwellSeconds)}</dd></div><div><dt>每人造訪</dt><dd>{ratio(page.visitsPerReader)}次</dd></div><div><dt>我不懂</dt><dd>{page.notUnderstoodCount}人</dd></div><div><dt>疑問Annotation</dt><dd>{page.questionAnnotationCount}筆</dd></div></dl>
        </div>)}</div>}
        {resource.pages.length > 12 && <div className="subtle insight-more-note">另有{resource.pages.length - 12}頁具有單一或多重線索，可至「頁面學習分析」查看完整原始指標。</div>}
      </article>)}
    </section>}

    <details className="card panel insight-method">
      <summary>分析方法與解讀限制</summary>
      <div className="insight-method-body">
        <p>教材頁面以班內相對分布比對平均停留時間、每位學生造訪次數、不理解回報比例與疑問Annotation比例。位於該教材較高區間的指標會形成一項關注線索，同一頁至少兩項才列為「多重線索頁面」。</p>
        <p>頁面停留較久或回訪較多不必然代表教材困難，也可能代表內容重要、教師指定複習或學生採取較深入閱讀策略。教師可再搭配「頁面學習分析」與「課程劃記總覽」確認。</p>
      </div>
    </details>
  </>;
}

export default function TeachingInsightsDashboard({ data, view }: { data: TeachingInsightsData; view: TeachingInsightView }) {
  const tabs: Array<{ key: TeachingInsightView; label: string; description: string }> = [
    { key: "participation", label: "學習參與分析", description: "辨識不同閱讀參與樣態" },
    { key: "difficulty", label: "閱讀困難線索", description: "整合自陳、疑問與閱讀行為" },
    { key: "materials", label: "教材關注分析", description: "找出值得教師進一步查看的頁面" },
  ];

  return <div className="stack analytics-page insight-page">
    <div className="page-head analytics-page-head">
      <div><Link href="/admin/insights" className="subtle">←返回教學洞察課程列表</Link><div className="row" style={{ marginTop: 14 }}><span className="badge">{data.course.semesterCode}</span><span className="subtle">{data.course.courseCode}</span></div><h1 className="h1" style={{ marginTop: 8 }}>{data.course.name}</h1><div className="subtle">教學洞察將平台既有閱讀歷程轉換為可解釋的行為模式與關注線索，不需要先匯出CSV。</div></div>
    </div>

    <section className="analytics-kpi-grid">
      <div className="card analytics-kpi"><span>修課學生</span><strong>{data.coverage.enrolledStudents}</strong><small>目前課程名單</small></div>
      <div className="card analytics-kpi"><span>已有閱讀紀錄</span><strong>{data.coverage.studentsWithReading}</strong><small>至少產生一次PageVisit</small></div>
      <div className="card analytics-kpi"><span>納入教材</span><strong>{data.coverage.analyzedResources}</strong><small>目前已開放的教材</small></div>
      <div className="card analytics-kpi"><span>PageVisit</span><strong>{data.coverage.pageVisits}</strong><small>本課程目前累積的頁面造訪紀錄</small></div>
    </section>

    <section className="insight-notice">
      <strong>解讀原則</strong>
      <span>本功能提供探索性的教學關注線索，只分析可觀察的閱讀行為，不把平台紀錄直接等同於學習動機、能力或學習成效。教師可透過既有「學習分析」查看原始指標並進一步判斷。</span>
    </section>

    <nav className="insight-tabs" aria-label="教學洞察分析類型">
      {tabs.map((tab) => <Link key={tab.key} href={viewHref(data.course.id, tab.key)} className={view === tab.key ? "active" : undefined}><strong>{tab.label}</strong><span>{tab.description}</span></Link>)}
    </nav>

    {view === "participation" && <ParticipationView data={data} />}
    {view === "difficulty" && <DifficultyView data={data} />}
    {view === "materials" && <MaterialsView data={data} />}
  </div>;
}
