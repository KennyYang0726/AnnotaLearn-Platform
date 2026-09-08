import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth/api";

export async function DELETE(_request: Request, { params }: { params: Promise<{ assistantId: string }> }) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { assistantId } = await params;
  const assistant = await prisma.user.findUnique({
    where: { id: assistantId },
    select: { id: true, username: true, role: true },
  });
  if (!assistant || assistant.role !== "TA") return NextResponse.json({ error: "找不到指定助教" }, { status: 404 });

  await prisma.user.delete({ where: { id: assistant.id } });
  return NextResponse.json({ ok: true, username: assistant.username });
}
