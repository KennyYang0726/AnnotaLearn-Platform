import Link from "next/link";
import { requireStudent } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
export default async function StudentCoursesPage() {
  const student = await requireStudent();
  const enrollments = await prisma.enrollment.findMany({ where: { userId: student.id }, include: { course: { include: { semester: true, resources: true } } }, orderBy: { createdAt: "desc" } });
  return <div className="stack"><div className="page-head"><h1 className="h1">我的課程</h1></div>
  {enrollments.length === 0 ? <section className="card panel"><div className="subtle">目前尚未被分配任何課程。</div></section> : <section className="grid-3">{enrollments.map(({course}) => <Link href={`/courses/${course.id}`} className="card course-card" key={course.id}><span className="badge" style={{ width: "fit-content" }}>{course.semester.code}</span><h2 className="h2" style={{ margin: 0 }}>{course.name}</h2><div className="subtle">{course.resources.length}份教材</div><span className="btn btn-primary" style={{ textAlign: "center" }}>進入課程</span></Link>)}</section>}</div>;
}
