import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import EnrollmentManager from "@/components/admin/EnrollmentManager";
import ResourceManager from "@/components/admin/ResourceManager";

export default async function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const course = await prisma.course.findUnique({ where: { id: courseId }, include: { semester: true, enrollments: true, resources: { include: { asset: true, _count: { select: { submissions: true } } }, orderBy: { sortOrder: "asc" } } } });
  if (!course) notFound();
  const [students, assets] = await Promise.all([
    prisma.user.findMany({ where: { role: "STUDENT" }, orderBy: { username: "asc" } }),
    prisma.asset.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const enrolledIds = new Set(course.enrollments.map((e) => e.userId));
  const assignedAssetIds = new Set(course.resources.map((r) => r.assetId));
  return <div className="stack">
    <div className="page-head"><div className="badge">{course.semester.code}</div><h1 className="h1" style={{ marginTop: 8 }}>{course.name}</h1><div className="subtle">課程ID：{course.courseCode}</div></div>
    <section className="card panel"><h2 className="h2">目前教材</h2>{course.resources.length === 0 ? <div className="subtle">尚未加入教材。</div> : course.resources.map((r, i) => <div className="resource-row between" key={r.id}><div><strong>{i + 1}. {r.title}</strong><div className="subtle">{r.asset.originalName}</div></div><span className="badge">{r._count.submissions}份已繳交</span></div>)}</section>
    <div className="grid-2"><section className="card panel"><h2 className="h2">學生分配</h2><EnrollmentManager courseId={course.id} students={students.map((s) => ({ id: s.id, username: s.username, displayName: s.displayName, enrolled: enrolledIds.has(s.id) }))} /></section>
    <section className="card panel"><h2 className="h2">加入PDF教材</h2>{assets.length ? <ResourceManager courseId={course.id} assets={assets.map((a) => ({ id: a.id, displayName: a.displayName, originalName: a.originalName, assigned: assignedAssetIds.has(a.id) }))} /> : <div className="subtle">資產庫目前沒有PDF，請先到PDF資產庫上傳。</div>}</section></div>
  </div>;
}
