import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth/api";

const schema = z.object({ userId: z.string().min(1), courseId: z.string().min(1) });

async function authorize() {
  const auth = await requireApiAdmin();
  if (!auth.ok) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  return { auth };
}

export async function POST(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "欄位格式錯誤" }, { status: 400 });

  const [assistant, course] = await Promise.all([
    prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, role: true } }),
    prisma.course.findUnique({ where: { id: parsed.data.courseId }, select: { id: true } }),
  ]);
  if (!assistant || assistant.role !== "TA") return NextResponse.json({ error: "找不到助教" }, { status: 404 });
  if (!course) return NextResponse.json({ error: "找不到課程" }, { status: 404 });

  await prisma.courseStaff.upsert({
    where: { userId_courseId: parsed.data },
    update: {},
    create: parsed.data,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const authorization = await authorize();
  if ("response" in authorization) return authorization.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "欄位格式錯誤" }, { status: 400 });
  await prisma.courseStaff.deleteMany({ where: parsed.data });
  return NextResponse.json({ ok: true });
}
