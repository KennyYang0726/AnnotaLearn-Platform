import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import ReaderClient from "@/components/reader/ReaderClient";

export default async function ReaderPage({ params }: { params: Promise<{ courseId: string; resourceId: string }> }) {
  const student = await requireStudent(); const { courseId, resourceId } = await params;
  const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: student.id, courseId } } });
  if (!enrollment) notFound();
  const resource = await prisma.courseResource.findFirst({ where: { id: resourceId, courseId }, include: { course: { select: { allowMaterialDownload: true } } } });
  if (!resource) notFound();
  return <ReaderClient resourceId={resource.id} courseId={courseId} studentId={student.id} title={resource.title} allowDownload={resource.course.allowMaterialDownload} />;
}
