import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth/api";
import { parseActivityFilters } from "@/lib/activity-filter";
import { buildResearchCsv } from "@/lib/research-export";

export async function GET(request: Request, { params }: { params: Promise<{ resourceId: string }> }) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { resourceId } = await params;
  const result = await buildResearchCsv(resourceId, parseActivityFilters(new URL(request.url).searchParams));
  if (!result) return NextResponse.json({ error: "找不到教材" }, { status: 404 });
  return new Response(result.csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${result.filename}"`, "Cache-Control": "no-store" } });
}
