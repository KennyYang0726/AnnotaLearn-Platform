import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth/api";

const schema = z.object({
  username: z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9_.-]+$/, "帳號只能使用英文字母、數字、底線、句點與連字號"),
  displayName: z.string().trim().max(100).optional().default(""),
  initialPassword: z.string().min(8).max(200),
  courseIds: z.array(z.string().min(1)).max(100).optional().default([]),
});

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "助教資料格式錯誤" }, { status: 400 });

  const username = parsed.data.username.trim();
  const existing = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: "此帳號已存在" }, { status: 409 });

  const uniqueCourseIds = Array.from(new Set(parsed.data.courseIds));
  if (uniqueCourseIds.length) {
    const validCourseCount = await prisma.course.count({ where: { id: { in: uniqueCourseIds } } });
    if (validCourseCount !== uniqueCourseIds.length) return NextResponse.json({ error: "包含不存在的課程" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.initialPassword, 12);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        username,
        displayName: parsed.data.displayName || null,
        passwordHash,
        role: "TA",
        mustChangePassword: true,
      },
      select: { id: true, username: true, displayName: true },
    });
    if (uniqueCourseIds.length) {
      await tx.courseStaff.createMany({
        data: uniqueCourseIds.map((courseId) => ({ userId: created.id, courseId })),
        skipDuplicates: true,
      });
    }
    return created;
  });

  return NextResponse.json({ ok: true, assistant: user });
}
