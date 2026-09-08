import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth/api";

const schema = z.object({ code: z.string().trim().regex(/^\d{3}-[123]$/, "格式需為114-1、114-2或114-3") });
export async function POST(request: Request) {
  const auth = await requireApiAdmin(); if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "格式錯誤" }, { status: 400 });
  try { const semester = await prisma.semester.create({ data: parsed.data }); return NextResponse.json({ semester }); }
  catch { return NextResponse.json({ error: "此學期已存在" }, { status: 409 }); }
}
