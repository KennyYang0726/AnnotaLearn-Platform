import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCourseManager, assignedCourseIdsForTa } from "@/lib/auth/course-access";
import { formatAppDateTimeDisplay } from "@/lib/app-timezone";
import AssetUploadForm from "@/components/admin/AssetUploadForm";
import ResourceManager from "@/components/admin/ResourceManager";
import CourseDownloadSetting from "@/components/admin/CourseDownloadSetting";
import CourseResourceOrderControls from "@/components/admin/CourseResourceOrderControls";

export default async function TaCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const ta = await requireCourseManager(courseId);
  if (ta.role !== "TA") notFound();

  const [course, assets, assignedCourseIds] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      include: {
        semester: true,
        enrollments: { include: { user: true }, orderBy: { user: { username: "asc" } } },
        resources: {
          include: {
            asset: true,
            _count: { select: { submissions: true, pageUnderstandingStates: true, pageUnderstandingEvents: true, pageVisits: true } },
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    }),
    prisma.asset.findMany({
      include: {
        createdBy: { select: { id: true, username: true, displayName: true, role: true } },
        resources: { select: { courseId: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    assignedCourseIdsForTa(ta.id),
  ]);
  if (!course) notFound();

  const assignedSet = new Set(assignedCourseIds);
  const courseResourceByAsset = new Map(course.resources.map((resource) => [resource.assetId, resource]));

  return <div className="stack">
    <div className="page-head">
      <Link href="/ta" className="subtle">←返回我的協作課程</Link>
      <div className="badge" style={{ marginTop: 14 }}>{course.semester.code}</div>
      <h1 className="h1" style={{ marginTop: 8 }}>{course.name}</h1>
      <div className="subtle">課程ID：{course.courseCode}</div>
      <div className="subtle" style={{ marginTop: 4 }}>課程期間：{formatAppDateTimeDisplay(course.startAt, { dateStyle: "medium", timeStyle: "short" })}～{formatAppDateTimeDisplay(course.endAt, { dateStyle: "medium", timeStyle: "short" })}</div>
    </div>

    <div className="ta-workspace-actions">
      <Link className="card ta-workspace-link" href={`/ta/courses/${course.id}/submissions`}><strong>閱讀 / 繳交紀錄</strong><span>查看本課學生閱讀、筆記、理解狀態與匯出資料</span></Link>
      <Link className="card ta-workspace-link" href={`/ta/courses/${course.id}/highlights`}><strong>課程劃記總覽</strong><span>疊合查看本課學生的重點與疑問劃記</span></Link>
    </div>

    <section className="card panel stack"><h2 className="h2">課程設定</h2><CourseDownloadSetting courseId={course.id} initialEnabled={course.allowMaterialDownload} endpoint={`/api/ta/courses/${course.id}`} /></section>

    <section className="card panel">
      <div className="between" style={{ marginBottom: 12 }}><div><h2 className="h2" style={{ margin: 0 }}>目前教材</h2><div className="subtle" style={{ marginTop: 4 }}>可調整學生端教材順序。</div></div></div>
      {course.resources.length === 0 ? <div className="subtle">尚未加入教材。</div> : course.resources.map((resource, index) => <div className="resource-row course-resource-row" key={resource.id}>
        <div className="course-resource-main"><strong>{index + 1}. {resource.title}</strong><div className="subtle asset-filename">{resource.asset.originalName}</div></div>
        <div className="course-resource-actions"><span className="badge">{resource._count.submissions}份已繳交</span><CourseResourceOrderControls courseId={course.id} resourceId={resource.id} canMoveUp={index > 0} canMoveDown={index < course.resources.length - 1} endpoint="/api/ta/course-resources" /></div>
      </div>)}
    </section>

    <section className="card panel stack">
      <div><h2 className="h2">上傳到共用 PDF 資產庫</h2><div className="subtle">你上傳的PDF會進入共用資產庫，其他課程可重複使用，但只有你本人與管理員可處理其永久刪除。</div></div>
      <AssetUploadForm apiBase="/api/ta/assets" afterUploadMessage="PDF已加入共用資產庫，可在下方選擇加入本課程。" />
    </section>

    <section className="card panel stack">
      <div><h2 className="h2">共用 PDF 資產庫</h2><div className="subtle">可將既有資產加入本課程。永久刪除只會對你自己上傳、且沒有超出你課程權限範圍使用的資產開放。</div></div>
      {assets.length === 0 ? <div className="subtle">目前沒有PDF資產。</div> : <ResourceManager
        courseId={course.id}
        resourceEndpoint="/api/ta/course-resources"
        assetDownloadBase="/api/ta/assets"
        assetDeleteBase="/api/ta/assets"
        showOwnership
        assets={assets.map((asset) => {
          const currentResource = courseResourceByAsset.get(asset.id);
          const learningRecordCount = currentResource ? currentResource._count.submissions + currentResource._count.pageUnderstandingStates + currentResource._count.pageUnderstandingEvents + currentResource._count.pageVisits : 0;
          const owned = asset.createdById === ta.id;
          const canDeleteOwnedAsset = owned && asset.resources.every((resource) => assignedSet.has(resource.courseId));
          return {
            id: asset.id,
            displayName: asset.displayName,
            originalName: asset.originalName,
            assigned: Boolean(currentResource),
            learningRecordCount,
            usageCount: asset.resources.length,
            ownedByCurrentUser: owned,
            canDeleteOwnedAsset,
            ownerLabel: asset.createdBy ? (asset.createdBy.role === "ADMIN" ? "管理員上傳" : asset.createdBy.displayName || asset.createdBy.username) : "共用/既有資產",
          };
        })}
      />}
    </section>

    <section className="card panel stack">
      <div><h2 className="h2">本課學生</h2><div className="subtle">助教工作區採課程範圍檢視，此處不提供全站學生帳號刪除或課程移出功能。</div></div>
      {course.enrollments.length === 0 ? <div className="subtle">目前沒有學生。</div> : <div className="table-wrap"><table><thead><tr><th>學號</th><th>姓名</th><th>系級</th><th>校內信箱</th></tr></thead><tbody>{course.enrollments.map((enrollment) => <tr key={enrollment.userId}><td><strong>{enrollment.user.username}</strong></td><td>{enrollment.user.displayName || "—"}</td><td>{enrollment.user.departmentGrade || "—"}</td><td>{enrollment.user.schoolEmail || "—"}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
