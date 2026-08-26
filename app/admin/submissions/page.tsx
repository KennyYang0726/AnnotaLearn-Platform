import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function SubmissionsPage() {
  const courses = await prisma.course.findMany({
    include: {
      semester: true,
      resources: { select: { id: true, _count: { select: { submissions: true } } } },
      _count: { select: { enrollments: true, resources: true } },
    },
    orderBy: [{ semester: { code: "desc" } }, { name: "asc" }],
  });

  return <div className="stack">
    <div className="page-head"><h1 className="h1">閱讀/繳交紀錄</h1></div>
    <section className="card panel">
      {courses.length === 0 ? <div className="subtle">目前尚未建立課程。</div> : <div className="admin-record-list">
        {courses.map((course) => {
          const submittedCount = course.resources.reduce((sum, resource) => sum + resource._count.submissions, 0);
          return <article className="admin-record-item" key={course.id}>
            <div>
              <div className="row"><span className="badge">{course.semester.code}</span><span className="subtle">{course.courseCode}</span></div>
              <div className="admin-record-title" style={{ marginTop: 8 }}>{course.name}</div>
              <div className="admin-record-meta">
                <span className="resource-meta">學生<strong>{course._count.enrollments}</strong></span>
                <span className="resource-meta">教材<strong>{course._count.resources}</strong></span>
                <span className="resource-meta">繳交紀錄<strong>{submittedCount}</strong></span>
              </div>
            </div>
            <div className="record-actions">
              <Link className="btn btn-primary btn-nowrap" href={`/admin/submissions/course/${course.id}`}>查看教材</Link>
            </div>
          </article>;
        })}
      </div>}
    </section>
  </div>;
}
