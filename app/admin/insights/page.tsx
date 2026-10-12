import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function AdminTeachingInsightsPage() {
  const courses = await prisma.course.findMany({
    include: {
      semester: true,
      _count: { select: { enrollments: true, resources: true } },
    },
    orderBy: [{ semester: { code: "desc" } }, { name: "asc" }],
  });

  return <div className="stack analytics-page insight-page">
    <div className="page-head"><h1 className="h1">教學洞察</h1><div className="subtle">直接使用平台既有學習歷程產生可解釋的學生行為群組、閱讀困難線索與教材關注線索，不需要先下載或重新上傳CSV。</div></div>
    <section className="insight-notice"><strong>與「學習分析」的差異</strong><span>「學習分析」保留原始可觀察指標與圖表，「教學洞察」則整合多項指標，協助教師先找到值得進一步查看的學生與教材內容。</span></section>
    {courses.length === 0 ? <section className="card panel"><div className="subtle">目前尚未建立課程。</div></section> : <div className="analytics-course-grid">{courses.map((course) => <article className="card analytics-course-card" key={course.id}>
      <div><div className="row"><span className="badge">{course.semester.code}</span><span className="subtle">{course.courseCode}</span></div><h2>{course.name}</h2></div>
      <div className="analytics-course-card-stats"><span>學生<strong>{course._count.enrollments}</strong></span><span>教材<strong>{course._count.resources}</strong></span></div>
      <Link className="btn btn-primary" href={`/admin/insights/courses/${course.id}`}>開啟教學洞察</Link>
    </article>)}</div>}
  </div>;
}
