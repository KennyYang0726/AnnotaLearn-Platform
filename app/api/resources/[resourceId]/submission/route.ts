import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getAuthorizedResource } from "@/lib/resource-access";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const auth = await requireApiUser(); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { resourceId } = await params; const resource = await getAuthorizedResource(resourceId, auth.user);
  if (!resource) return NextResponse.json({ error: "找不到教材或沒有存取權限" }, { status: 404 });
  if (auth.user.role === "ADMIN") return NextResponse.json({ submission: null });
  const submission = await prisma.readingSubmission.findUnique({ where: { userId_resourceId: { userId: auth.user.id, resourceId } }, include: { notes: { orderBy: [{ page: "asc" }, { createdAt: "asc" }] }, highlights: { orderBy: [{ page: "asc" }, { createdAt: "asc" }] } } });
  if (!submission) return NextResponse.json({ submission: null });
  return NextResponse.json({ submission: { lastPage: submission.lastPage, submittedAt: submission.submittedAt, notes: submission.notes.map((n) => ({ id: n.clientId, page: n.page, type: n.type, content: n.content })), highlights: submission.highlights.map((h) => ({ id: h.clientId, page: h.page, type: h.type, color: h.color, extractedText: h.extractedText, points: (h.geometry as { points?: [number, number][] }).points || [] })) } });
}
