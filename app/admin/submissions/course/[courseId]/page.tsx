import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function SubmissionCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      semester: true,
      resources: {
        include: {
          asset: true,
          submissions: { select: { id: true, notes: { select: { id: true } }, highlights: { select: { id: true } } } },
        },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!course) notFound();

  return <div className="stack">
    <div className="page-head">
      <Link href="/admin/submissions" className="subtle">←返回課程列表</Link>
      <div className="badge" style={{ marginTop: 14 }}>{course.semester.code}</div>
      <h1 className="h1" style={{ marginTop: 8 }}>{course.name}</h1>
      <div className="subtle">課程ID：{course.courseCode}</div>
    </div>

    <section className="card panel">
      {course.resources.length === 0 ? <div className="subtle">此課程目前沒有PDF教材。</div> : <div className="highlight-resource-list">
        {course.resources.map((resource, index) => {
          const noteCount = resource.submissions.reduce((sum, submission) => sum + submission.notes.length, 0);
          const highlightCount = resource.submissions.reduce((sum, submission) => sum + submission.highlights.length, 0);
          return <article className="highlight-resource-item" key={resource.id}>
            <div className="resource-index">{index + 1}</div>
            <div className="resource-main">
              <div className="resource-title">{resource.title}</div>
              <div className="resource-filename">{resource.asset.originalName}</div>
              <div className="resource-meta-row">
                <span className="resource-meta">已繳交<strong>{resource.submissions.length}/{course._count.enrollments}</strong></span>
                <span className="resource-meta">文字筆記<strong>{noteCount}</strong></span>
                <span className="resource-meta">螢光筆劃記<strong>{highlightCount}</strong></span>
              </div>
            </div>
            <div className="record-actions">
              <a className="btn btn-outline btn-nowrap" href={`/api/admin/submissions/resources/${resource.id}/export`}>匯出CSV</a>
              <Link className="btn btn-primary btn-nowrap" href={`/admin/submissions/course/${course.id}/resource/${resource.id}`}>查看學生紀錄</Link>
            </div>
          </article>;
        })}
      </div>}
    </section>
  </div>;
}
