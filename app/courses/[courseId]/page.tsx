import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
export default async function StudentCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const student = await requireStudent(); const { courseId } = await params;
  const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: student.id, courseId } }, include: { course: { include: { semester: true, resources: { include: { asset: true, submissions: { where: { userId: student.id }, take: 1 } }, orderBy: { sortOrder: "asc" } } } } } });
  if (!enrollment) notFound(); const course = enrollment.course;
  return <div className="stack"><div className="page-head"><Link href="/courses" className="subtle">←返回我的課程</Link><div style={{ marginTop: 12 }}><span className="badge">{course.semester.code}</span><h1 className="h1" style={{ marginTop: 8 }}>{course.name}</h1></div></div>
  <section className="card panel"><h2 className="h2">教材資源</h2>{course.resources.length === 0 ? <div className="subtle">目前尚無教材。</div> : course.resources.map((r, index) => { const submission = r.submissions[0]; return <div className="resource-row between" key={r.id}><div><div className="subtle">{String(index+1).padStart(2,"0")} / PDF教材</div><strong>{r.title}</strong><div className="subtle">{r.asset.pageCount ? `${r.asset.pageCount}頁` : "PDF"} / {submission ? `已繳交 ${new Intl.DateTimeFormat("zh-TW", { dateStyle: "short", timeStyle: "short" }).format(submission.submittedAt)}` : "尚未繳交"}</div></div><div className="row"><a className="btn btn-outline" href={`/api/resources/${r.id}/download`}>下載教材</a><Link className="btn btn-primary" href={`/courses/${course.id}/resources/${r.id}`}>{submission ? "查看/編輯" : "進入教材"}</Link></div></div>; })}</section></div>;
}
