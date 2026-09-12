import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import ReaderClient from "@/components/reader/ReaderClient";
import { APP_TIME_ZONE } from "@/lib/app-timezone";
import { isReadingTaskAvailable } from "@/lib/reading-task";

export default async function ReaderPage({ params }: { params: Promise<{ courseId: string; resourceId: string }> }) {
  const student = await requireStudent(); const { courseId, resourceId } = await params;
  const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: student.id, courseId } } });
  if (!enrollment) notFound();
  const resource = await prisma.courseResource.findFirst({ where: { id: resourceId, courseId }, include: { course: { select: { allowMaterialDownload: true } } } });
  if (!resource || !isReadingTaskAvailable(resource)) notFound();
  return <ReaderClient resourceId={resource.id} courseId={courseId} studentId={student.id} title={resource.title} allowDownload={resource.course.allowMaterialDownload} appTimeZone={APP_TIME_ZONE} />;
}
