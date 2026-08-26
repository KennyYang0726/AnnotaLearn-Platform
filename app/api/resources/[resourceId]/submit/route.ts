import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { getAuthorizedResource } from "@/lib/resource-access";
import { prisma } from "@/lib/db";

const note = z.object({ id: z.string().min(1).max(100), page: z.number().int().positive(), type: z.enum(["KEY_POINT", "QUESTION"]), content: z.string().trim().min(1).max(5000) });
const point = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);
const highlight = z.object({ id: z.string().min(1).max(100), page: z.number().int().positive(), type: z.enum(["IMPORTANT", "QUESTION"]), color: z.enum(["RED", "YELLOW"]), extractedText: z.string().max(5000).optional().nullable(), points: z.array(point).min(2).max(10000) });
const schema = z.object({ lastPage: z.number().int().positive(), notes: z.array(note).max(1000), highlights: z.array(highlight).max(3000) });

export async function POST(request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const auth = await requireApiUser(); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== "STUDENT") return NextResponse.json({ error: "只有學生可以繳交閱讀內容" }, { status: 403 });
  const { resourceId } = await params; const resource = await getAuthorizedResource(resourceId, auth.user);
  if (!resource) return NextResponse.json({ error: "找不到教材或沒有存取權限" }, { status: 404 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "筆記或劃記資料格式錯誤", detail: parsed.error.issues[0]?.message }, { status: 400 });
  const data = parsed.data;
  const pageCount = resource.asset.pageCount;
  if (pageCount && (data.lastPage > pageCount || data.notes.some((n) => n.page > pageCount) || data.highlights.some((h) => h.page > pageCount))) {
    return NextResponse.json({ error: "提交內容包含超出PDF頁數的頁碼" }, { status: 400 });
  }
  const submittedAt = await prisma.$transaction(async (tx) => {
    const submission = await tx.readingSubmission.upsert({ where: { userId_resourceId: { userId: auth.user.id, resourceId } }, update: { lastPage: data.lastPage, submittedAt: new Date(), status: "SUBMITTED" }, create: { userId: auth.user.id, resourceId, lastPage: data.lastPage, status: "SUBMITTED" } });
    await tx.note.deleteMany({ where: { submissionId: submission.id } });
    await tx.highlight.deleteMany({ where: { submissionId: submission.id } });
    if (data.notes.length) await tx.note.createMany({ data: data.notes.map((n) => ({ submissionId: submission.id, clientId: n.id, page: n.page, type: n.type, content: n.content })) });
    if (data.highlights.length) await tx.highlight.createMany({ data: data.highlights.map((h) => ({ submissionId: submission.id, clientId: h.id, page: h.page, type: h.type, color: h.color, extractedText: h.extractedText || null, geometry: { points: h.points } })) });
    return submission.submittedAt;
  });
  return NextResponse.json({ ok: true, message: "作業已成功繳交", submittedAt });
}
