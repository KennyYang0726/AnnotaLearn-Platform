import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function HighlightResourcesPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      semester: true,
      resources: {
        include: {
          asset: true,
          submissions: { select: { id: true, highlights: { select: { id: true } } } },
        },
        orderBy: { sortOrder: "asc" },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!course) notFound();

  return <div className="stack">
    <div className="page-head">
      <Link href="/admin/highlights" className="subtle">←返回課程劃記總覽</Link>
      <div className="badge" style={{ marginTop: 14 }}>{course.semester.code}</div>
      <h1 className="h1" style={{ marginTop: 8 }}>{course.name}</h1>
      
    </div>

    <section className="card panel">
      <div className="between resource-section-head">
        <div>
          <h2 className="h2">PDF教材</h2>
          <div className="subtle">共{course.resources.length}份教材</div>
        </div>
      </div>

      {course.resources.length === 0 ? <div className="empty-state subtle">此課程目前沒有PDF教材。</div> : (
        <div className="highlight-resource-list">
          {course.resources.map((resource, index) => {
            const highlightCount = resource.submissions.reduce((sum, submission) => sum + submission.highlights.length, 0);
            return <article className="highlight-resource-item" key={resource.id}>
              <div className="resource-index">{index + 1}</div>
              <div className="resource-main">
                <div className="resource-title">{resource.title}</div>
                <div className="resource-filename">{resource.asset.originalName}</div>
                <div className="resource-meta-row">
                  <span className="resource-meta">頁數<strong>{resource.asset.pageCount ?? "—"}</strong></span>
                  <span className="resource-meta">已繳交<strong>{resource.submissions.length}</strong></span>
                  <span className="resource-meta">劃記<strong>{highlightCount}</strong></span>
                </div>
              </div>
              <div className="resource-action">
                <Link className="btn btn-primary btn-nowrap" href={`/admin/highlights/${course.id}/${resource.id}`}>查看劃記</Link>
              </div>
            </article>;
          })}
        </div>
      )}
    </section>
  </div>;
}
