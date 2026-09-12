import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { getAuthorizedResource } from "@/lib/resource-access";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const point = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);
const noteUpsert = z.object({
  action: z.literal("NOTE_UPSERT"),
  note: z.object({
    id: z.string().min(1).max(100),
    page: z.number().int().positive(),
    type: z.enum(["KEY_POINT", "QUESTION"]),
    content: z.string().max(5000),
    recordedAt: z.string().min(1).max(50).refine((value) => !Number.isNaN(Date.parse(value))),
  }),
});
const noteDelete = z.object({ action: z.literal("NOTE_DELETE"), id: z.string().min(1).max(100) });
const highlightCreate = z.object({
  action: z.literal("HIGHLIGHT_CREATE"),
  highlight: z.object({
    id: z.string().min(1).max(100),
    page: z.number().int().positive(),
    type: z.enum(["IMPORTANT", "QUESTION"]),
    color: z.enum(["RED", "YELLOW"]),
    extractedText: z.string().max(5000).optional().nullable(),
    points: z.array(point).min(2).max(10000),
    strokeWidthRatio: z.number().min(0.005).max(0.08).optional(),
    recordedAt: z.string().min(1).max(50).refine((value) => !Number.isNaN(Date.parse(value))),
  }),
});
const highlightDelete = z.object({ action: z.literal("HIGHLIGHT_DELETE"), id: z.string().min(1).max(100) });
const schema = z.discriminatedUnion("action", [noteUpsert, noteDelete, highlightCreate, highlightDelete]);

export async function POST(request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "STUDENT") return NextResponse.json({ error: "只有學生可以建立教材註記" }, { status: 403 });

  const { resourceId } = await params;
  const resource = await getAuthorizedResource(resourceId, auth.user);
  if (!resource) return NextResponse.json({ error: "找不到教材或沒有存取權限" }, { status: 404 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "註記資料格式錯誤", detail: parsed.error.issues[0]?.message }, { status: 400 });
  const data = parsed.data;
  const page = "note" in data ? data.note.page : "highlight" in data ? data.highlight.page : null;
  if (page && resource.asset.pageCount && page > resource.asset.pageCount) return NextResponse.json({ error: "頁碼超出PDF頁數" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    let submission = await tx.readingSubmission.findUnique({
      where: { userId_resourceId: { userId: auth.user.id, resourceId } },
    });

    const ensureSubmission = async (lastPage: number) => {
      if (submission) return submission;
      submission = await tx.readingSubmission.create({
        data: { userId: auth.user.id, resourceId, lastPage, status: "DRAFT" },
      });
      return submission;
    };

    const markDraft = async (submissionId: string, lastPage: number) => {
      await tx.readingSubmission.update({
        where: { id: submissionId },
        data: { status: "DRAFT", lastPage },
      });
    };

    if (data.action === "NOTE_UPSERT") {
      const currentSubmission = await ensureSubmission(data.note.page);
      const existing = await tx.note.findUnique({
        where: { submissionId_clientId: { submissionId: currentSubmission.id, clientId: data.note.id } },
      });
      const recordedAt = new Date(data.note.recordedAt);
      const changed = !existing || existing.page !== data.note.page || existing.type !== data.note.type || existing.content !== data.note.content;
      if (!changed) return { changed: false };

      await markDraft(currentSubmission.id, data.note.page);
      await tx.note.upsert({
        where: { submissionId_clientId: { submissionId: currentSubmission.id, clientId: data.note.id } },
        update: { page: data.note.page, type: data.note.type, content: data.note.content },
        create: { submissionId: currentSubmission.id, clientId: data.note.id, page: data.note.page, type: data.note.type, content: data.note.content, recordedAt },
      });
      await tx.annotationEvent.create({
        data: { userId: auth.user.id, resourceId, clientId: data.note.id, entityType: "NOTE", action: existing ? "UPDATE" : "CREATE", source: "AUTO_SYNC", page: data.note.page, noteType: data.note.type, content: data.note.content },
      });
      return { changed: true };
    }

    if (data.action === "NOTE_DELETE") {
      if (!submission) return { changed: false };
      const existing = await tx.note.findUnique({
        where: { submissionId_clientId: { submissionId: submission.id, clientId: data.id } },
      });
      if (!existing) return { changed: false };

      await markDraft(submission.id, existing.page);
      await tx.annotationEvent.create({
        data: { userId: auth.user.id, resourceId, clientId: data.id, entityType: "NOTE", action: "DELETE", source: "AUTO_SYNC", page: existing.page, noteType: existing.type, content: existing.content },
      });
      await tx.note.delete({ where: { id: existing.id } });
      return { changed: true };
    }

    if (data.action === "HIGHLIGHT_CREATE") {
      const currentSubmission = await ensureSubmission(data.highlight.page);
      const existing = await tx.highlight.findUnique({
        where: { submissionId_clientId: { submissionId: currentSubmission.id, clientId: data.highlight.id } },
      });
      const geometry = { points: data.highlight.points, ...(data.highlight.strokeWidthRatio ? { strokeWidthRatio: data.highlight.strokeWidthRatio } : {}) };
      const recordedAt = new Date(data.highlight.recordedAt);
      const extractedText = data.highlight.extractedText || null;
      const changed = !existing || existing.page !== data.highlight.page || existing.type !== data.highlight.type || existing.color !== data.highlight.color || existing.extractedText !== extractedText || JSON.stringify(existing.geometry) !== JSON.stringify(geometry);
      if (!changed) return { changed: false };

      await markDraft(currentSubmission.id, data.highlight.page);
      await tx.highlight.upsert({
        where: { submissionId_clientId: { submissionId: currentSubmission.id, clientId: data.highlight.id } },
        update: { page: data.highlight.page, type: data.highlight.type, color: data.highlight.color, extractedText, geometry },
        create: { submissionId: currentSubmission.id, clientId: data.highlight.id, page: data.highlight.page, type: data.highlight.type, color: data.highlight.color, extractedText, geometry, recordedAt },
      });
      await tx.annotationEvent.create({
        data: { userId: auth.user.id, resourceId, clientId: data.highlight.id, entityType: "HIGHLIGHT", action: existing ? "UPDATE" : "CREATE", source: "AUTO_SYNC", page: data.highlight.page, highlightType: data.highlight.type, color: data.highlight.color, extractedText, geometry },
      });
      return { changed: true };
    }

    if (!submission) return { changed: false };
    const existing = await tx.highlight.findUnique({
      where: { submissionId_clientId: { submissionId: submission.id, clientId: data.id } },
    });
    if (!existing) return { changed: false };

    await markDraft(submission.id, existing.page);
    await tx.annotationEvent.create({
      data: { userId: auth.user.id, resourceId, clientId: data.id, entityType: "HIGHLIGHT", action: "DELETE", source: "AUTO_SYNC", page: existing.page, highlightType: existing.type, color: existing.color, extractedText: existing.extractedText, geometry: existing.geometry as Prisma.InputJsonValue },
    });
    await tx.highlight.delete({ where: { id: existing.id } });
    return { changed: true };
  });

  return NextResponse.json({ ok: true, ...result });
}
