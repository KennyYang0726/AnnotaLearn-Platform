import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { recordCourseDailyActivity } from "@/lib/reading-activity";
import { formatAppDateTimeDisplay } from "@/lib/app-timezone";
import { isReadingTaskAvailable, isReadingTaskOverdue } from "@/lib/reading-task";

export default async function StudentCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const student = await requireStudent();
  const { courseId } = await params;
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: student.id, courseId } },
    include: {
      course: {
        include: {
          semester: true,
          sections: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          resources: {
            include: { asset: true, submissions: { where: { userId: student.id, status: "SUBMITTED" }, take: 1 } },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });
  if (!enrollment) notFound();
  const course = enrollment.course;

  await recordCourseDailyActivity({ courseId: course.id, userId: student.id, courseStartAt: course.startAt, courseEndAt: course.endAt });

  const renderResource = (resource: typeof course.resources[number], index: number) => {
    const submission = resource.submissions[0];
    const available = isReadingTaskAvailable(resource);
    const overdue = isReadingTaskOverdue(resource);
    const firstSubmissionAt = submission?.firstSubmittedAt ?? submission?.lastSubmittedAt ?? submission?.submittedAt ?? null;
    const submittedLate = Boolean(firstSubmissionAt && resource.dueAt && firstSubmissionAt > resource.dueAt);
    return <article className={`student-resource-card ${!available ? "student-resource-locked" : ""}`} key={resource.id}>
      <div className="student-resource-main">
        <div className="row student-resource-meta">
          <span className="subtle">{String(index + 1).padStart(2, "0")} / PDF教材</span>
          {resource.readingTaskEnabled && <span className="badge reading-task-badge">閱讀任務</span>}
          {!available && <span className="badge task-status-upcoming">尚未開放</span>}
          {available && overdue && !submission && <span className="badge task-status-overdue">已逾期・可補交</span>}
          {submittedLate && <span className="badge task-status-overdue">逾期繳交</span>}
        </div>
        <strong className="student-resource-title">{resource.title}</strong>
        <div className="subtle">{resource.asset.pageCount ? `${resource.asset.pageCount}頁` : "PDF"}{submission ? ` / 已繳交 ${formatAppDateTimeDisplay(submission.lastSubmittedAt ?? submission.submittedAt!, { dateStyle: "short", timeStyle: "short" })}` : " / 尚未繳交"}</div>
        {resource.readingTaskEnabled && <div className="student-task-window">
          {resource.availableFrom && <span>開放：{formatAppDateTimeDisplay(resource.availableFrom, { dateStyle: "medium", timeStyle: "short" })}</span>}
          {resource.dueAt && <span>截止：{formatAppDateTimeDisplay(resource.dueAt, { dateStyle: "medium", timeStyle: "short" })}</span>}
          {!resource.availableFrom && !resource.dueAt && <span>教師未設定時間限制</span>}
        </div>}
      </div>
      <div className="student-resource-actions">
        {course.allowMaterialDownload && available && <a className="btn btn-outline" href={`/api/resources/${resource.id}/download`}>下載教材</a>}
        {available ? <Link className="btn btn-primary" href={`/courses/${course.id}/resources/${resource.id}`}>{submission ? "查看/編輯" : "進入教材"}</Link> : <button className="btn" type="button" disabled>尚未開放</button>}
      </div>
    </article>;
  };

  let displayIndex = 0;
  const unassigned = course.resources.filter((resource) => !resource.sectionId);

  return <div className="stack">
    <div className="page-head">
      <Link href="/courses" className="subtle">←返回我的課程</Link>
      <div style={{ marginTop: 12 }}><span className="badge">{course.semester.code}</span><h1 className="h1" style={{ marginTop: 8 }}>{course.name}</h1><div className="subtle">課程期間：{formatAppDateTimeDisplay(course.startAt, { dateStyle: "medium", timeStyle: "short" })}～{formatAppDateTimeDisplay(course.endAt, { dateStyle: "medium", timeStyle: "short" })}</div></div>
    </div>
    <section className="card panel stack student-course-content">
      <div><h2 className="h2">課程教材</h2><div className="subtle">教材依教師設定的課程單元排列；閱讀任務若有開放或截止時間，會在教材下方標示。</div></div>
      {course.resources.length === 0 ? <div className="subtle">目前尚無教材。</div> : <>
        {course.sections.map((section) => {
          const resources = course.resources.filter((resource) => resource.sectionId === section.id);
          if (resources.length === 0) return null;
          return <section className="student-course-section" key={section.id}><div className="student-course-section-head"><div><span className="student-section-kicker">COURSE UNIT</span><h3>{section.title}</h3>{section.description && <p>{section.description}</p>}</div><span className="badge">{resources.length}份教材</span></div><div>{resources.map((resource) => renderResource(resource, ++displayIndex))}</div></section>;
        })}
        {unassigned.length > 0 && <section className="student-course-section student-course-section-unassigned"><div className="student-course-section-head"><div><span className="student-section-kicker">MATERIALS</span><h3>{course.sections.length ? "其他教材" : "教材資源"}</h3>{course.sections.length > 0 && <p>尚未歸入特定課程單元的教材。</p>}</div><span className="badge">{unassigned.length}份教材</span></div><div>{unassigned.map((resource) => renderResource(resource, ++displayIndex))}</div></section>}
      </>}
    </section>
  </div>;
}
