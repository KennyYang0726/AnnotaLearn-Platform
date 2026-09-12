import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { getAuthorizedResource } from "@/lib/resource-access";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const recordedAt = z.string().min(1).max(50).refine((value) => !Number.isNaN(Date.parse(value)), "日期格式錯誤");
const note = z.object({ id: z.string().min(1).max(100), page: z.number().int().positive(), type: z.enum(["KEY_POINT", "QUESTION"]), content: z.string().trim().min(1).max(5000), recordedAt });
const point = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);
const highlight = z.object({ id: z.string().min(1).max(100), page: z.number().int().positive(), type: z.enum(["IMPORTANT", "QUESTION"]), color: z.enum(["RED", "YELLOW"]), extractedText: z.string().max(5000).optional().nullable(), points: z.array(point).min(2).max(10000), strokeWidthRatio: z.number().min(0.005).max(0.08).optional(), recordedAt });
const schema = z.object({ lastPage: z.number().int().positive(), notes: z.array(note).max(1000), highlights: z.array(highlight).max(3000) });

export async function POST(request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "STUDENT") return NextResponse.json({ error: "只有學生可以繳交閱讀內容" }, { status: 403 });

  const { resourceId } = await params;
  const resource = await getAuthorizedResource(resourceId, auth.user);
  if (!resource) return NextResponse.json({ error: "找不到教材或沒有存取權限" }, { status: 404 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "筆記或劃記資料格式錯誤", detail: parsed.error.issues[0]?.message }, { status: 400 });
  const data = parsed.data;
  const pageCount = resource.asset.pageCount;
  if (pageCount && (data.lastPage > pageCount || data.notes.some((n) => n.page > pageCount) || data.highlights.some((h) => h.page > pageCount))) {
    return NextResponse.json({ error: "提交內容包含超出PDF頁數的頁碼" }, { status: 400 });
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const existingSubmission = await tx.readingSubmission.findUnique({
      where: { userId_resourceId: { userId: auth.user.id, resourceId } },
      include: { notes: true, highlights: true },
    });
    const submission = existingSubmission ?? await tx.readingSubmission.create({
      data: { userId: auth.user.id, resourceId, lastPage: data.lastPage, status: "DRAFT" },
      include: { notes: true, highlights: true },
    });

    const existingNotes = new Map(submission.notes.map((item) => [item.clientId, item]));
    const incomingNoteIds = new Set(data.notes.map((item) => item.id));
    for (const current of submission.notes) {
      if (incomingNoteIds.has(current.clientId)) continue;
      await tx.annotationEvent.create({ data: { userId: auth.user.id, resourceId, clientId: current.clientId, entityType: "NOTE", action: "DELETE", source: "SUBMIT_SYNC", page: current.page, noteType: current.type, content: current.content } });
      await tx.note.delete({ where: { id: current.id } });
    }
    for (const item of data.notes) {
      const previous = existingNotes.get(item.id);
      const changed = !previous || previous.page !== item.page || previous.type !== item.type || previous.content !== item.content;
      await tx.note.upsert({
        where: { submissionId_clientId: { submissionId: submission.id, clientId: item.id } },
        update: { page: item.page, type: item.type, content: item.content },
        create: { submissionId: submission.id, clientId: item.id, page: item.page, type: item.type, content: item.content, recordedAt: new Date(item.recordedAt) },
      });
      if (changed) await tx.annotationEvent.create({ data: { userId: auth.user.id, resourceId, clientId: item.id, entityType: "NOTE", action: previous ? "UPDATE" : "CREATE", source: "SUBMIT_SYNC", page: item.page, noteType: item.type, content: item.content } });
    }

    const existingHighlights = new Map(submission.highlights.map((item) => [item.clientId, item]));
    const incomingHighlightIds = new Set(data.highlights.map((item) => item.id));
    for (const current of submission.highlights) {
      if (incomingHighlightIds.has(current.clientId)) continue;
      await tx.annotationEvent.create({ data: { userId: auth.user.id, resourceId, clientId: current.clientId, entityType: "HIGHLIGHT", action: "DELETE", source: "SUBMIT_SYNC", page: current.page, highlightType: current.type, color: current.color, extractedText: current.extractedText, geometry: current.geometry as Prisma.InputJsonValue } });
      await tx.highlight.delete({ where: { id: current.id } });
    }
    for (const item of data.highlights) {
      const geometry = { points: item.points, ...(item.strokeWidthRatio ? { strokeWidthRatio: item.strokeWidthRatio } : {}) };
      const previous = existingHighlights.get(item.id);
      const changed = !previous || previous.page !== item.page || previous.type !== item.type || previous.color !== item.color || previous.extractedText !== (item.extractedText || null) || JSON.stringify(previous.geometry) !== JSON.stringify(geometry);
      await tx.highlight.upsert({
        where: { submissionId_clientId: { submissionId: submission.id, clientId: item.id } },
        update: { page: item.page, type: item.type, color: item.color, extractedText: item.extractedText || null, geometry },
        create: { submissionId: submission.id, clientId: item.id, page: item.page, type: item.type, color: item.color, extractedText: item.extractedText || null, geometry, recordedAt: new Date(item.recordedAt) },
      });
      if (changed) await tx.annotationEvent.create({ data: { userId: auth.user.id, resourceId, clientId: item.id, entityType: "HIGHLIGHT", action: previous ? "UPDATE" : "CREATE", source: "SUBMIT_SYNC", page: item.page, highlightType: item.type, color: item.color, extractedText: item.extractedText || null, geometry } });
    }

    const firstSubmittedAt = submission.firstSubmittedAt ?? now;
    const updated = await tx.readingSubmission.update({
      where: { id: submission.id },
      data: {
        lastPage: data.lastPage,
        status: "SUBMITTED",
        submittedAt: now,
        firstSubmittedAt,
        lastSubmittedAt: now,
        submissionCount: { increment: 1 },
      },
    });
    return updated;
  });

  return NextResponse.json({ ok: true, message: "作業已成功繳交", submittedAt: result.lastSubmittedAt ?? result.submittedAt, firstSubmittedAt: result.firstSubmittedAt, submissionCount: result.submissionCount });
}
