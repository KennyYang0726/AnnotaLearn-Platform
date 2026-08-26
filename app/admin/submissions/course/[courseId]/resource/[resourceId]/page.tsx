import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function SubmissionResourcePage({ params }: { params: Promise<{ courseId: string; resourceId: string }> }) {
  const { courseId, resourceId } = await params;
  const resource = await prisma.courseResource.findFirst({
    where: { id: resourceId, courseId },
    include: {
      asset: true,
      course: {
        include: {
          semester: true,
          enrollments: { include: { user: true } },
        },
      },
      submissions: {
        include: { _count: { select: { notes: true, highlights: true } } },
      },
    },
  });
  if (!resource) notFound();

  const submissionMap = new Map(resource.submissions.map((submission) => [submission.userId, submission]));
  const students = [...resource.course.enrollments].sort((a, b) => a.user.username.localeCompare(b.user.username));

  return <div className="stack">
    <div className="page-head">
      <Link href={`/admin/submissions/course/${courseId}`} className="subtle">←返回教材列表</Link>
      <h1 className="h1" style={{ marginTop: 14 }}>{resource.title}</h1>
      <div className="subtle">{resource.course.semester.code} / {resource.course.name} / {resource.asset.originalName}</div>
    </div>

    <section className="card panel">
      <div className="between" style={{ marginBottom: 14 }}>
        <h2 className="h2" style={{ margin: 0 }}>學生紀錄</h2>
        <a className="btn btn-outline btn-nowrap" href={`/api/admin/submissions/resources/${resource.id}/export`}>匯出CSV</a>
      </div>
      {students.length === 0 ? <div className="subtle">此課程目前沒有學生。</div> : <div className="table-wrap"><table>
        <thead><tr><th>學號</th><th>姓名</th><th>繳交狀態</th><th>最後閱讀頁</th><th>文字筆記</th><th>螢光筆劃記</th><th>繳交時間</th><th></th></tr></thead>
        <tbody>{students.map((enrollment) => {
          const submission = submissionMap.get(enrollment.userId);
          return <tr key={enrollment.userId}>
            <td><strong>{enrollment.user.username}</strong></td>
            <td>{enrollment.user.displayName || "—"}</td>
            <td>{submission ? <span className="status-submitted">已繳交</span> : <span className="status-pending">尚未繳交</span>}</td>
            <td>{submission?.lastPage ?? "—"}</td>
            <td>{submission?._count.notes ?? 0}</td>
            <td>{submission?._count.highlights ?? 0}</td>
            <td>{submission ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "short", timeStyle: "short" }).format(submission.submittedAt) : "—"}</td>
            <td>{submission ? <Link className="btn btn-primary btn-compact btn-nowrap" href={`/admin/submissions/${submission.id}`}>查看紀錄</Link> : "—"}</td>
          </tr>;
        })}</tbody>
      </table></div>}
    </section>
  </div>;
}
