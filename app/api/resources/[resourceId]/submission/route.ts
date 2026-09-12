import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getAuthorizedResource } from "@/lib/resource-access";
import { prisma } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const auth = await requireApiUser();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { resourceId } = await params;
  const resource = await getAuthorizedResource(resourceId, auth.user);
  if (!resource) return NextResponse.json({ error: "找不到教材或沒有存取權限" }, { status: 404 });
  if (auth.user.role === "ADMIN") return NextResponse.json({ submission: null });

  const submission = await prisma.readingSubmission.findUnique({
    where: { userId_resourceId: { userId: auth.user.id, resourceId } },
    include: {
      notes: { orderBy: [{ page: "asc" }, { recordedAt: "asc" }] },
      highlights: { orderBy: [{ page: "asc" }, { recordedAt: "asc" }] },
    },
  });
  if (!submission) return NextResponse.json({ submission: null });

  return NextResponse.json({
    submission: {
      status: submission.status,
      lastPage: submission.lastPage,
      submittedAt: submission.submittedAt,
      firstSubmittedAt: submission.firstSubmittedAt,
      lastSubmittedAt: submission.lastSubmittedAt,
      submissionCount: submission.submissionCount,
      notes: submission.notes.map((note) => ({ id: note.clientId, page: note.page, type: note.type, content: note.content, recordedAt: note.recordedAt.toISOString() })),
      highlights: submission.highlights.map((highlight) => {
        const geometry = highlight.geometry as { points?: [number, number][]; strokeWidthRatio?: number };
        return {
          id: highlight.clientId,
          page: highlight.page,
          type: highlight.type,
          color: highlight.color,
          extractedText: highlight.extractedText,
          points: geometry.points || [],
          strokeWidthRatio: typeof geometry.strokeWidthRatio === "number" ? geometry.strokeWidthRatio : undefined,
          recordedAt: highlight.recordedAt.toISOString(),
        };
      }),
    },
  });
}
