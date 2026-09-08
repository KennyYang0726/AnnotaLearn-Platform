import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireTa } from "@/lib/auth/guards";
import { formatAppDateTimeDisplay } from "@/lib/app-timezone";

export default async function TaHomePage() {
  const ta = await requireTa();
  const assignments = await prisma.courseStaff.findMany({
    where: { userId: ta.id },
    include: {
      course: {
        include: { semester: true, _count: { select: { enrollments: true, resources: true } } },
      },
    },
    orderBy: [{ course: { semester: { code: "desc" } } }, { course: { name: "asc" } }],
  });

  return <div className="stack">
    <div className="page-head"><h1 className="h1">我的協作課程</h1><div className="subtle">只會顯示管理員分配給你的課程，其他課程無法查看或操作。</div></div>
    {assignments.length === 0 ? <section className="card panel empty-state"><strong>目前尚未分配課程</strong><div className="subtle" style={{ marginTop: 8 }}>請由系統管理員在「助教管理」中完成課程分配。</div></section> : <div className="ta-course-grid">
      {assignments.map(({ course }) => <article className="card ta-course-card" key={course.id}>
        <div><span className="badge">{course.semester.code}</span><h2 className="h2" style={{ marginTop: 10 }}>{course.name}</h2><div className="subtle">{course.courseCode}</div></div>
        <div className="ta-course-meta"><span>學生 <strong>{course._count.enrollments}</strong></span><span>教材 <strong>{course._count.resources}</strong></span></div>
        <div className="subtle">{formatAppDateTimeDisplay(course.startAt, { dateStyle: "medium", timeStyle: "short" })} ～ {formatAppDateTimeDisplay(course.endAt, { dateStyle: "medium", timeStyle: "short" })}</div>
        <Link className="btn btn-primary" href={`/ta/courses/${course.id}`}>進入課程工作區</Link>
      </article>)}
    </div>}
  </div>;
}
