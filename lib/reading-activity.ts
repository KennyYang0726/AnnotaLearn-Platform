import "server-only";
import { prisma } from "@/lib/db";
import { appDateAsDbDate } from "@/lib/app-timezone";

export function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hours, minutes, secs].map((value) => String(value).padStart(2, "0")).join(":");
}

export function coursePeriodContains(startAt: Date, endAt: Date, at: Date) {
  return at.getTime() >= startAt.getTime() && at.getTime() <= endAt.getTime();
}

export async function recordCourseDailyActivity(args: {
  courseId: string;
  userId: string;
  courseStartAt: Date;
  courseEndAt: Date;
  at?: Date;
}) {
  const at = args.at ?? new Date();
  if (!coursePeriodContains(args.courseStartAt, args.courseEndAt, at)) return false;
  const activityDate = appDateAsDbDate(at);
  await prisma.courseDailyActivity.upsert({
    where: { courseId_userId_activityDate: { courseId: args.courseId, userId: args.userId, activityDate } },
    update: { lastActivityAt: at },
    create: { courseId: args.courseId, userId: args.userId, activityDate, firstActivityAt: at, lastActivityAt: at },
  });
  return true;
}
