import "server-only";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";

export async function getAuthorizedResource(resourceId: string, user: SessionUser) {
  const resource = await prisma.courseResource.findUnique({
    where: { id: resourceId },
    include: { asset: true, course: true },
  });
  if (!resource) return null;
  if (user.role === "ADMIN") return resource;

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId: resource.courseId } },
  });
  return enrollment ? resource : null;
}
