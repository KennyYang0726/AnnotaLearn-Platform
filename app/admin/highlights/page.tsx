import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function HighlightCoursesPage() {
  const courses = await prisma.course.findMany({
    include: {
      semester: true,
      resources: { select: { id: true, _count: { select: { submissions: true } } } },
      _count: { select: { enrollments: true, resources: true } },
    },
    orderBy: [{ semester: { code: "desc" } }, { name: "asc" }],
  });

  return <div className="stack">
    <div className="page-head"><h1 className="h1">課程劃記總覽</h1></div>
    <section className="card panel">
      {courses.length === 0 ? <div className="subtle">目前尚未建立課程。</div> : <div className="table-wrap"><table>
        <thead><tr><th>學期</th><th>課程</th><th>課程ID</th><th>學生</th><th>PDF教材</th><th>已有繳交</th><th></th></tr></thead>
        <tbody>{courses.map((course) => {
          const submissionCount = course.resources.reduce((sum, resource) => sum + resource._count.submissions, 0);
          return <tr key={course.id}>
            <td>{course.semester.code}</td>
            <td><strong>{course.name}</strong></td>
            <td>{course.courseCode}</td>
            <td>{course._count.enrollments}</td>
            <td>{course._count.resources}</td>
            <td>{submissionCount}</td>
            <td><Link className="btn btn-primary btn-nowrap" href={`/admin/highlights/${course.id}`}>查看教材</Link></td>
          </tr>;
        })}</tbody>
      </table></div>}
    </section>
  </div>;
}
