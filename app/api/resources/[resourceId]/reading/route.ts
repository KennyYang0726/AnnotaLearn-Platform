import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { getAuthorizedResource } from "@/lib/resource-access";
import { prisma } from "@/lib/db";
import { recordCourseDailyActivity } from "@/lib/reading-activity";

const enterSchema = z.object({
  action: z.literal("ENTER"),
  page: z.number().int().positive(),
  clientVisitId: z.string().min(1).max(100),
  readerSessionId: z.string().min(1).max(100),
});
const heartbeatSchema = z.object({ action: z.literal("HEARTBEAT"), clientVisitId: z.string().min(1).max(100) });
const leaveSchema = z.object({
  action: z.literal("LEAVE"),
  clientVisitId: z.string().min(1).max(100),
  reason: z.enum(["NAVIGATION", "HIDDEN", "PAGEHIDE", "UNMOUNT", "BLUR", "IDLE"]).optional(),
});
const understandingSchema = z.object({
  action: z.literal("UNDERSTANDING"),
  page: z.number().int().positive(),
  status: z.enum(["UNDERSTOOD", "NOT_UNDERSTOOD"]),
});
const actionSchema = z.discriminatedUnion("action", [enterSchema, heartbeatSchema, leaveSchema, understandingSchema]);
const ACTIVE_SESSION_WINDOW_MS = 35_000;

function durationIncrement(lastSeenAt: Date, now: Date) {
  // Heartbeat runs every 10 seconds. Cap a delayed event so sleep/background tabs
  // cannot turn one page visit into hours of fake reading time.
  return Math.max(0, Math.min(30, Math.floor((now.getTime() - lastSeenAt.getTime()) / 1000)));
}

export async function GET(_request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "STUDENT") return NextResponse.json({ understanding: [], visitedPages: [] });

  const { resourceId } = await params;
  const resource = await getAuthorizedResource(resourceId, auth.user);
  if (!resource) return NextResponse.json({ error: "找不到教材或沒有存取權限" }, { status: 404 });

  const [states, visited] = await Promise.all([
    prisma.pageUnderstandingState.findMany({
      where: { userId: auth.user.id, resourceId },
      select: { page: true, status: true, selectedAt: true },
      orderBy: { page: "asc" },
    }),
    prisma.pageVisit.findMany({
      where: { userId: auth.user.id, resourceId },
      select: { page: true },
      distinct: ["page"],
      orderBy: { page: "asc" },
    }),
  ]);

  return NextResponse.json({
    understanding: states.map((state) => ({ page: state.page, status: state.status, selectedAt: state.selectedAt.toISOString() })),
    visitedPages: visited.map((visit) => visit.page),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "STUDENT") return NextResponse.json({ error: "只有學生會建立閱讀行為紀錄" }, { status: 403 });

  const { resourceId } = await params;
  const resource = await getAuthorizedResource(resourceId, auth.user);
  if (!resource) return NextResponse.json({ error: "找不到教材或沒有存取權限" }, { status: 404 });

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "閱讀紀錄格式錯誤" }, { status: 400 });
  const data = parsed.data;
  const now = new Date();

  if ((data.action === "ENTER" || data.action === "UNDERSTANDING") && resource.asset.pageCount && data.page > resource.asset.pageCount) {
    return NextResponse.json({ error: "頁碼超出PDF頁數" }, { status: 400 });
  }

  if (data.action === "ENTER") {
    const existing = await prisma.pageVisit.findUnique({ where: { clientVisitId: data.clientVisitId } });
    if (existing) {
      if (existing.userId !== auth.user.id || existing.resourceId !== resourceId) return NextResponse.json({ error: "閱讀紀錄識別碼衝突" }, { status: 409 });
      return NextResponse.json({ ok: true, visitId: existing.clientVisitId });
    }

    const activeCutoff = new Date(now.getTime() - ACTIVE_SESSION_WINDOW_MS);

    // An abnormal close may leave an open visit in the database. Once its
    // heartbeat lease expires, close it without adding unconfirmed time.
    const staleVisits = await prisma.pageVisit.findMany({
      where: {
        userId: auth.user.id,
        resourceId,
        leftAt: null,
        lastSeenAt: { lt: activeCutoff },
      },
      select: { id: true, lastSeenAt: true },
    });
    if (staleVisits.length > 0) {
      await prisma.$transaction(
        staleVisits.map((visit) =>
          prisma.pageVisit.update({
            where: { id: visit.id },
            data: { leftAt: visit.lastSeenAt, endReason: "STALE_TIMEOUT" },
          }),
        ),
      );
    }

    // Only one actively-heartbeating reader session for the same student and
    // material is accepted. This prevents two devices/tabs from doubling the
    // research-facing dwell time. A stale session naturally expires after the
    // heartbeat lease above.
    const competingSession = await prisma.pageVisit.findFirst({
      where: {
        userId: auth.user.id,
        resourceId,
        readerSessionId: { not: data.readerSessionId },
        leftAt: null,
        lastSeenAt: { gte: activeCutoff },
      },
      select: { id: true },
    });
    if (competingSession) {
      return NextResponse.json(
        { error: "此教材目前已在另一個分頁或裝置進行閱讀，為避免重複計時，請只保留一個閱讀視窗。" },
        { status: 409 },
      );
    }

    // If a navigation/close request was lost, entering the next page in the
    // same reader session closes the prior open visit. Heartbeats have already
    // persisted its confirmed duration, so no extra seconds are fabricated.
    await prisma.pageVisit.updateMany({
      where: {
        userId: auth.user.id,
        resourceId,
        readerSessionId: data.readerSessionId,
        leftAt: null,
      },
      data: { leftAt: now, endReason: "SESSION_REPLACED" },
    });

    await prisma.pageVisit.create({
      data: {
        clientVisitId: data.clientVisitId,
        readerSessionId: data.readerSessionId,
        userId: auth.user.id,
        resourceId,
        page: data.page,
        enteredAt: now,
        lastSeenAt: now,
      },
    });
    await recordCourseDailyActivity({ courseId: resource.courseId, userId: auth.user.id, courseStartAt: resource.course.startAt, courseEndAt: resource.course.endAt, at: now });
    return NextResponse.json({ ok: true, visitId: data.clientVisitId });
  }

  if (data.action === "HEARTBEAT") {
    const visit = await prisma.pageVisit.findUnique({ where: { clientVisitId: data.clientVisitId } });
    if (!visit || visit.userId !== auth.user.id || visit.resourceId !== resourceId || visit.leftAt) return NextResponse.json({ ok: true, active: false });
    const increment = durationIncrement(visit.lastSeenAt, now);
    await prisma.pageVisit.update({
      where: { id: visit.id },
      data: { lastSeenAt: now, durationSeconds: { increment } },
    });
    await recordCourseDailyActivity({ courseId: resource.courseId, userId: auth.user.id, courseStartAt: resource.course.startAt, courseEndAt: resource.course.endAt, at: now });
    return NextResponse.json({ ok: true, active: true, durationSeconds: visit.durationSeconds + increment });
  }

  if (data.action === "LEAVE") {
    const visit = await prisma.pageVisit.findUnique({ where: { clientVisitId: data.clientVisitId } });
    if (!visit || visit.userId !== auth.user.id || visit.resourceId !== resourceId || visit.leftAt) return NextResponse.json({ ok: true });
    const increment = durationIncrement(visit.lastSeenAt, now);
    await prisma.pageVisit.update({
      where: { id: visit.id },
      data: { lastSeenAt: now, leftAt: now, endReason: data.reason ?? "UNMOUNT", durationSeconds: { increment } },
    });
    await recordCourseDailyActivity({ courseId: resource.courseId, userId: auth.user.id, courseStartAt: resource.course.startAt, courseEndAt: resource.course.endAt, at: now });
    return NextResponse.json({ ok: true });
  }

  const existingState = await prisma.pageUnderstandingState.findUnique({
    where: { userId_resourceId_page: { userId: auth.user.id, resourceId, page: data.page } },
  });

  if (existingState?.status === data.status) {
    await recordCourseDailyActivity({ courseId: resource.courseId, userId: auth.user.id, courseStartAt: resource.course.startAt, courseEndAt: resource.course.endAt, at: now });
    return NextResponse.json({ ok: true, changed: false, status: existingState.status, selectedAt: existingState.selectedAt.toISOString() });
  }

  const state = await prisma.$transaction(async (tx) => {
    const next = await tx.pageUnderstandingState.upsert({
      where: { userId_resourceId_page: { userId: auth.user.id, resourceId, page: data.page } },
      update: { status: data.status, selectedAt: now },
      create: { userId: auth.user.id, resourceId, page: data.page, status: data.status, selectedAt: now },
    });
    await tx.pageUnderstandingEvent.create({ data: { userId: auth.user.id, resourceId, page: data.page, status: data.status, recordedAt: now } });
    return next;
  });
  await recordCourseDailyActivity({ courseId: resource.courseId, userId: auth.user.id, courseStartAt: resource.course.startAt, courseEndAt: resource.course.endAt, at: now });
  return NextResponse.json({ ok: true, changed: true, status: state.status, selectedAt: state.selectedAt.toISOString() });
}
