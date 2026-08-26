import { prisma } from "@/lib/db";

export default async function AdminDashboardPage() {
  const [students, courses, assets, submissions] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.course.count(),
    prisma.asset.count(),
    prisma.readingSubmission.count(),
  ]);
  const recentCourses = await prisma.course.findMany({ include: { semester: true, _count: { select: { enrollments: true, resources: true } } }, orderBy: { createdAt: "desc" }, take: 5 });
  return <div className="stack">
    <div className="page-head"><h1 className="h1">管理端儀表板</h1></div>
    <section className="stat-grid">
      <div className="card stat"><div className="subtle">學生人數</div><div className="stat-value">{students}</div></div>
      <div className="card stat"><div className="subtle">課程數量</div><div className="stat-value">{courses}</div></div>
      <div className="card stat"><div className="subtle">PDF資產</div><div className="stat-value">{assets}</div></div>
      <div className="card stat"><div className="subtle">已繳交教材</div><div className="stat-value">{submissions}</div></div>
    </section>
    <section className="card panel"><h2 className="h2">最近課程</h2><div className="table-wrap"><table><thead><tr><th>學期</th><th>課程</th><th>課程ID</th><th>學生</th><th>教材</th></tr></thead><tbody>{recentCourses.map((course) => <tr key={course.id}><td>{course.semester.code}</td><td>{course.name}</td><td>{course.courseCode}</td><td>{course._count.enrollments}</td><td>{course._count.resources}</td></tr>)}</tbody></table></div></section>
  </div>;
}
