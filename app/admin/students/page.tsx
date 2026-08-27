import Link from "next/link";
import { prisma } from "@/lib/db";
import DeleteStudentButton from "@/components/admin/DeleteStudentButton";
import ResetStudentPasswordButton from "@/components/admin/ResetStudentPasswordButton";

export default async function StudentsPage() {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    include: { _count: { select: { enrollments: true, submissions: true } } },
    orderBy: { username: "asc" },
  });

  return <div className="stack">
    <div className="page-head between">
      <div><h1 className="h1">學生管理</h1></div>
      <div className="row">
        <Link className="btn btn-outline" href="/admin/students/import">匯入Excel名單</Link>
        <Link className="btn btn-primary" href="/admin/students/new">新增學生</Link>
      </div>
    </div>
    <section className="card panel">
      <div className="table-wrap">
        <table>
          <thead><tr><th>學號</th><th>姓名/系級</th><th>校內信箱</th><th>密碼狀態</th><th>已分配課程</th><th>已繳交教材</th><th>建立時間</th><th className="action-column">操作</th></tr></thead>
          <tbody>{students.map((s) => <tr key={s.id}>
            <td><strong>{s.username}</strong></td>
            <td>{s.displayName || "—"}<div className="subtle">{s.departmentGrade || ""}</div></td>
            <td>{s.schoolEmail || "—"}</td>
            <td>{s.mustChangePassword ? <span className="badge">尚未變更初始密碼</span> : "已變更"}</td>
            <td>{s._count.enrollments}</td>
            <td>{s._count.submissions}</td>
            <td>{new Intl.DateTimeFormat("zh-TW").format(s.createdAt)}</td>
            <td className="action-column"><div className="row" style={{ flexWrap: "nowrap", gap: 8 }}><ResetStudentPasswordButton studentId={s.id} username={s.username} displayName={s.displayName} /><DeleteStudentButton studentId={s.id} username={s.username} displayName={s.displayName} enrollmentCount={s._count.enrollments} submissionCount={s._count.submissions} /></div></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </div>;
}
