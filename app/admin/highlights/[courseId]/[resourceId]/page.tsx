import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import AdminHighlightViewer from "@/components/admin/AdminHighlightViewer";
import { formatTaipeiDate } from "@/lib/activity-filter";

type Geometry = { points?: [number, number][]; strokeWidthRatio?: number };

export default async function HighlightResourceDetailPage({ params }: { params: Promise<{ courseId: string; resourceId: string }> }) {
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
        include: {
          user: true,
          highlights: { orderBy: [{ page: "asc" }, { recordedAt: "asc" }] },
        },
      },
    },
  });
  if (!resource) notFound();

  const submissionMap = new Map(resource.submissions.map((submission) => [submission.userId, submission]));
  const students = [...resource.course.enrollments].sort((a, b) => a.user.username.localeCompare(b.user.username)).map((enrollment) => {
    const submission = submissionMap.get(enrollment.userId);
    return {
      id: enrollment.user.id,
      username: enrollment.user.username,
      displayName: enrollment.user.displayName,
      submitted: Boolean(submission),
      highlightCount: submission?.highlights.length ?? 0,
    };
  });

  const highlights = resource.submissions.flatMap((submission) => submission.highlights.map((highlight) => {
    const geometry = highlight.geometry as Geometry;
    return {
      id: highlight.id,
      studentId: submission.userId,
      username: submission.user.username,
      displayName: submission.user.displayName,
      page: highlight.page,
      color: highlight.color === "RED" ? "RED" as const : "YELLOW" as const,
      points: Array.isArray(geometry.points) ? geometry.points : [],
      strokeWidthRatio: typeof geometry.strokeWidthRatio === "number" ? geometry.strokeWidthRatio : undefined,
      recordedDate: formatTaipeiDate(highlight.recordedAt),
    };
  })).filter((highlight) => highlight.points.length >= 2);

  return <div className="stack">
    <div className="page-head">
      <Link href={`/admin/highlights/${courseId}`} className="subtle">←返回{resource.course.name}教材列表</Link>
      <h1 className="h1" style={{ marginTop: 14 }}>{resource.title}</h1>
      <div className="subtle">{resource.course.semester.code} / {resource.course.name} / {resource.asset.originalName}</div>
    </div>
    <AdminHighlightViewer resourceId={resource.id} title={resource.title} students={students} highlights={highlights} />
  </div>;
}
