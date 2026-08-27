import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireApiAdmin } from "@/lib/auth/api";
import { generateCourseCode } from "@/lib/course-code";
import { parseTaipeiDateTimeLocal } from "@/lib/reading-activity";

const schema = z.object({
  semesterId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
});

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "欄位格式錯誤" }, { status: 400 });

  const startAt = parseTaipeiDateTimeLocal(parsed.data.startAt);
  const endAt = parseTaipeiDateTimeLocal(parsed.data.endAt);
  if (!startAt || !endAt) return NextResponse.json({ error: "課程起訖時間格式錯誤" }, { status: 400 });
  if (endAt.getTime() <= startAt.getTime()) return NextResponse.json({ error: "課程結束時間必須晚於起始時間" }, { status: 400 });

  const semester = await prisma.semester.findUnique({ where: { id: parsed.data.semesterId } });
  if (!semester) return NextResponse.json({ error: "找不到學期" }, { status: 404 });

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const course = await prisma.course.create({
        data: { name: parsed.data.name, semesterId: semester.id, courseCode: generateCourseCode(semester.code), startAt, endAt },
      });
      return NextResponse.json({ course });
    } catch {
      if (attempt === 4) return NextResponse.json({ error: "無法產生唯一課程ID，請重試" }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "建立失敗" }, { status: 500 });
}
