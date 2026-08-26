import { prisma } from "@/lib/db";
import SemesterForm from "@/components/admin/SemesterForm";
import DeleteAdminEntityButton from "@/components/admin/DeleteAdminEntityButton";

export default async function SemestersPage() {
  const semesters = await prisma.semester.findMany({
    include: { _count: { select: { courses: true } } },
    orderBy: { code: "desc" },
  });

  return (
    <div className="stack">
      <div className="page-head"><h1 className="h1">學期管理</h1></div>
      <div className="grid-2">
        <section className="card panel">
          <h2 className="h2">新增學期</h2>
          <SemesterForm />
        </section>
        <section className="card panel">
          <h2 className="h2">學期列表</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>學期</th><th>課程數</th><th className="action-column">操作</th></tr></thead>
              <tbody>
                {semesters.map((semester) => (
                  <tr key={semester.id}>
                    <td>{semester.code}</td>
                    <td>{semester._count.courses}</td>
                    <td className="action-column">
                      <DeleteAdminEntityButton
                        endpoint={`/api/admin/semesters/${semester.id}`}
                        title="刪除學期？"
                        subject={semester.code}
                        detail="刪除學期後無法復原。"
                        impact={semester._count.courses > 0 ? `此學期包含${semester._count.courses}門課程；刪除後，這些課程及其課程分配、繳交、筆記與劃記紀錄也會一併刪除。資產庫中的原始教材檔案不會刪除。` : "此學期目前沒有課程。"}
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
