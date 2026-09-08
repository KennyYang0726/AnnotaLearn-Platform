import "server-only";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";
import { requireUser } from "@/lib/auth/guards";
import { requireApiUser } from "@/lib/auth/api";

export async function canManageCourse(user: SessionUser, courseId: string) {
  if (user.role === "ADMIN") return true;
  if (user.role !== "TA") return false;
  const assignment = await prisma.courseStaff.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { id: true },
  });
  return Boolean(assignment);
}

export async function requireCourseManager(courseId: string) {
  const user = await requireUser();
  if (user.role === "STUDENT") redirect("/courses");
  if (!(await canManageCourse(user, courseId))) notFound();
  return user;
}

export async function requireApiCourseManager(courseId: string) {
  const auth = await requireApiUser();
  if (!auth.ok) return auth;
  if (!(await canManageCourse(auth.user, courseId))) {
    return { ok: false as const, status: 403, error: "沒有此課程的管理權限" };
  }
  return auth;
}

export async function assignedCourseIdsForTa(userId: string) {
  const rows = await prisma.courseStaff.findMany({ where: { userId }, select: { courseId: true } });
  return rows.map((row) => row.courseId);
}
