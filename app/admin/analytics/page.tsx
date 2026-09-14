import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function AdminAnalyticsPage() {
  const courses = await prisma.course.findMany({
    include: {
      semester: true,
      _count: { select: { enrollments: true, resources: true } },
    },
    orderBy: [{ semester: { code: "desc" } }, { name: "asc" }],
  });

  return <div className="stack analytics-page">
    <div className="page-head"><h1 className="h1">學習分析</h1><div className="subtle">從課程層級進入教材與頁面分析，指標以可觀察的學習歷程為主，不建立投入度或困難度分數。</div></div>
    {courses.length === 0 ? <section className="card panel"><div className="subtle">目前尚未建立課程。</div></section> : <div className="analytics-course-grid">{courses.map((course) => <article className="card analytics-course-card" key={course.id}>
      <div><div className="row"><span className="badge">{course.semester.code}</span><span className="subtle">{course.courseCode}</span></div><h2>{course.name}</h2></div>
      <div className="analytics-course-card-stats"><span>學生<strong>{course._count.enrollments}</strong></span><span>教材<strong>{course._count.resources}</strong></span></div>
      <Link className="btn btn-primary" href={`/admin/analytics/courses/${course.id}`}>開啟課程Dashboard</Link>
    </article>)}</div>}
  </div>;
}
