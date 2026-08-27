import Link from "next/link";
import { prisma } from "@/lib/db";
import CourseForm from "@/components/admin/CourseForm";
import DeleteAdminEntityButton from "@/components/admin/DeleteAdminEntityButton";

export default async function CoursesPage() {
  const [semesters, courses] = await Promise.all([
    prisma.semester.findMany({ orderBy: { code: "desc" } }),
    prisma.course.findMany({
      include: {
        semester: true,
        _count: { select: { enrollments: true, resources: true } },
      },
      orderBy: [{ semester: { code: "desc" } }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <div className="stack">
      <div className="page-head"><h1 className="h1">課程管理</h1></div>
      <div className="grid-2">
        <section className="card panel">
          <h2 className="h2">新增課程</h2>
          <CourseForm semesters={semesters.map(({ id, code }) => ({ id, code }))} />
        </section>
        <section className="card panel">
          <h2 className="h2">課程列表</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>學期</th><th>課程</th><th>ID</th><th>課程期間</th><th>學生</th><th>教材</th><th className="action-column">操作</th></tr></thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id}>
                    <td>{course.semester.code}</td>
                    <td><Link href={`/admin/courses/${course.id}`}><strong>{course.name}</strong></Link></td>
                    <td>{course.courseCode}</td>
                    <td>{new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "short", timeStyle: "short" }).format(course.startAt)}<br/><span className="subtle">至 {new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "short", timeStyle: "short" }).format(course.endAt)}</span></td>
                    <td>{course._count.enrollments}</td>
                    <td>{course._count.resources}</td>
                    <td className="action-column">
                      <DeleteAdminEntityButton
                        endpoint={`/api/admin/courses/${course.id}`}
                        title="刪除課程？"
                        subject={`${course.semester.code} ${course.name}`}
                        detail="資產庫中的原始教材檔案不會刪除。"
                        impact={`此課程目前有${course._count.enrollments}位學生、${course._count.resources}份教材。刪除後，課程分配、繳交、筆記與劃記紀錄會一併刪除。`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
