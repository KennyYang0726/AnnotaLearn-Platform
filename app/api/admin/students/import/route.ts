import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { defaultStudentPassword } from "@/lib/password";
import { hashPasswordsBatch } from "@/lib/password-hash-batch";
import { normalizeStudentId } from "@/lib/student-account";

export const runtime = "nodejs";

const STUDENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_ROWS = 500;

const rowSchema = z.object({
  studentId: z.string().trim().min(1).max(50),
  name: z.string().trim().max(100).optional().default(""),
  departmentGrade: z.string().trim().max(120).optional().default(""),
  schoolEmail: z.string().trim().max(254).optional().default(""),
  externalEmail: z.string().trim().max(254).optional().default(""),
  note: z.string().trim().max(500).optional().default(""),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).min(1).max(MAX_ROWS),
  courseId: z.string().trim().min(1).optional().nullable(),
});

type ImportRow = z.infer<typeof rowSchema>;

function profile(row: ImportRow) {
  return {
    displayName: row.name || null,
    departmentGrade: row.departmentGrade || null,
    schoolEmail: row.schoolEmail || null,
    externalEmail: row.externalEmail || null,
    rosterNote: row.note || null,
  };
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "匯入資料格式錯誤" }, { status: 400 });
    }

    const uniqueRows: ImportRow[] = [];
    const seen = new Set<string>();
    let duplicateCount = 0;
    let invalidCount = 0;

    for (const row of parsed.data.rows) {
      const studentId = normalizeStudentId(row.studentId);
      if (!STUDENT_ID_PATTERN.test(studentId) || studentId.length > 50) {
        invalidCount++;
        continue;
      }
      if (seen.has(studentId)) {
        duplicateCount++;
        continue;
      }
      seen.add(studentId);
      uniqueRows.push({ ...row, studentId });
    }

    if (!uniqueRows.length) {
      return NextResponse.json({ error: "這份名單沒有可匯入的學生" }, { status: 400 });
    }

    const ids = uniqueRows.map((row) => row.studentId);
    const existing = await prisma.user.findMany({
      where: { username: { in: ids } },
      select: {
        id: true,
        username: true,
        role: true,
      },
    });

    const existingMap = new Map(existing.map((user) => [normalizeStudentId(user.username), user]));
    const newRows = uniqueRows.filter((row) => !existingMap.has(row.studentId));
    const updateRows = uniqueRows.filter((row) => existingMap.get(row.studentId)?.role === "STUDENT");
    const conflictCount = uniqueRows.filter((row) => existingMap.get(row.studentId)?.role === "ADMIN").length;

    let courseId = parsed.data.courseId || null;
    if (courseId) {
      const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } });
      if (!course) return NextResponse.json({ error: "找不到指定課程" }, { status: 404 });
    }

    const passwordHashes = await hashPasswordsBatch(
      newRows.map((row) => defaultStudentPassword(row.studentId)),
    );

    const createData = newRows.map((row, index) => ({
      username: row.studentId,
      passwordHash: passwordHashes[index],
      role: "STUDENT" as const,
      mustChangePassword: true,
      ...profile(row),
    }));

    await prisma.$transaction(async (tx) => {
      if (createData.length) {
        await tx.user.createMany({ data: createData, skipDuplicates: true });
      }

      // 既有學生仍允許以匯入名單更新基本資料，但不重設密碼。
      for (const row of updateRows) {
        const existingUser = existingMap.get(row.studentId)!;
        await tx.user.update({
          where: { id: existingUser.id },
          data: { username: row.studentId, ...profile(row) },
        });
      }
    });

    const usableStudents = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        username: { in: ids },
      },
      select: { id: true, username: true },
      orderBy: { username: "asc" },
    });

    let enrollmentResult: null | {
      courseId: string;
      addedCount: number;
      alreadyEnrolledCount: number;
    } = null;

    if (courseId && usableStudents.length) {
      const userIds = usableStudents.map((student) => student.id);
      const existingEnrollments = await prisma.enrollment.findMany({
        where: { courseId, userId: { in: userIds } },
        select: { userId: true },
      });
      const existingIds = new Set(existingEnrollments.map((item) => item.userId));
      const toCreate = userIds.filter((userId) => !existingIds.has(userId));

      if (toCreate.length) {
        await prisma.enrollment.createMany({
          data: toCreate.map((userId) => ({ courseId: courseId!, userId })),
          skipDuplicates: true,
        });
      }

      enrollmentResult = {
        courseId,
        addedCount: toCreate.length,
        alreadyEnrolledCount: userIds.length - toCreate.length,
      };
    }

    return NextResponse.json({
      ok: true,
      createdCount: newRows.length,
      existingCount: updateRows.length,
      skippedCount: duplicateCount + invalidCount + conflictCount,
      duplicateCount,
      invalidCount,
      conflictCount,
      users: usableStudents,
      enrollment: enrollmentResult,
    });
  } catch (error) {
    console.error("Student import failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "學生匯入失敗" }, { status: 400 });
  }
}
