import "server-only";
import { prisma } from "@/lib/db";

export const TAIPEI_TIME_ZONE = "Asia/Taipei";

export function taipeiDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIPEI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function taipeiDateAsDbDate(date: Date) {
  return new Date(`${taipeiDateKey(date)}T00:00:00.000Z`);
}

export function parseTaipeiDateTimeLocal(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}:00+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatTaipeiDateTimeInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIPEI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: "year" | "month" | "day" | "hour" | "minute") => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

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
  const activityDate = taipeiDateAsDbDate(at);
  await prisma.courseDailyActivity.upsert({
    where: { courseId_userId_activityDate: { courseId: args.courseId, userId: args.userId, activityDate } },
    update: { lastActivityAt: at },
    create: { courseId: args.courseId, userId: args.userId, activityDate, firstActivityAt: at, lastActivityAt: at },
  });
  return true;
}
