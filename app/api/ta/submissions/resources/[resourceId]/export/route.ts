import { NextResponse } from "next/server";
import { requireApiTa } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { parseActivityFilters } from "@/lib/activity-filter";
import { buildResearchCsv } from "@/lib/research-export";

export async function GET(request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const auth = await requireApiTa();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { resourceId } = await params;
  const resource = await prisma.courseResource.findUnique({ where: { id: resourceId }, select: { courseId: true } });
  if (!resource) return NextResponse.json({ error: "找不到教材" }, { status: 404 });
  const assignment = await prisma.courseStaff.findUnique({ where: { userId_courseId: { userId: auth.user.id, courseId: resource.courseId } }, select: { id: true } });
  if (!assignment) return NextResponse.json({ error: "沒有此課程的匯出權限" }, { status: 403 });
  const result = await buildResearchCsv(resourceId, parseActivityFilters(new URL(request.url).searchParams));
  if (!result) return NextResponse.json({ error: "找不到教材" }, { status: 404 });
  return new Response(result.csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${result.filename}"`, "Cache-Control": "no-store" } });
}
