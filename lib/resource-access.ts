import "server-only";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";

export async function getAuthorizedResource(resourceId: string, user: SessionUser, options?: { allowTa?: boolean }) {
  const resource = await prisma.courseResource.findUnique({
    where: { id: resourceId },
    include: { asset: true, course: true },
  });
  if (!resource) return null;
  if (user.role === "ADMIN") return resource;

  if (user.role === "TA") {
    if (!options?.allowTa) return null;
    const assignment = await prisma.courseStaff.findUnique({
      where: { userId_courseId: { userId: user.id, courseId: resource.courseId } },
      select: { id: true },
    });
    return assignment ? resource : null;
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: resource.courseId } },
  });
  return enrollment ? resource : null;
}
