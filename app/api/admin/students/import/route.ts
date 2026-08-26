import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireApiAdmin } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { defaultStudentPassword } from "@/lib/password";
import { parseStudentRoster, type StudentRosterRow } from "@/lib/student-roster";
import { normalizeStudentId } from "@/lib/student-account";

export const runtime = "nodejs";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const STUDENT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function profile(row: StudentRosterRow) {
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
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "請重新選擇Excel名單" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Excel名單上限10MB" }, { status: 413 });

    const parsedRows = parseStudentRoster(new Uint8Array(await file.arrayBuffer()));
    const uniqueRows: StudentRosterRow[] = [];
    const seen = new Set<string>();
    let duplicateCount = 0;
    let invalidCount = 0;

    for (const row of parsedRows) {
      const key = normalizeStudentId(row.studentId);
      if (!STUDENT_ID_PATTERN.test(key) || key.length > 50) { invalidCount++; continue; }
      if (seen.has(key)) { duplicateCount++; continue; }
      seen.add(key);
      uniqueRows.push({ ...row, studentId: key });
    }

    const ids = uniqueRows.map((row) => row.studentId);
    const existing = ids.length
      ? await prisma.user.findMany({
          where: { OR: ids.map((username) => ({ username: { equals: username, mode: "insensitive" as const } })) },
          select: { id: true, username: true, role: true },
        })
      : [];
    const existingMap = new Map(existing.map((user) => [user.username.toUpperCase(), user]));
    const newRows = uniqueRows.filter((row) => !existingMap.has(row.studentId));
    const updateRows = uniqueRows.filter((row) => existingMap.get(row.studentId)?.role === "STUDENT");
    const conflictCount = uniqueRows.filter((row) => existingMap.get(row.studentId)?.role === "ADMIN").length;

    const createData = await Promise.all(newRows.map(async (row) => ({
      username: row.studentId,
      passwordHash: await bcrypt.hash(defaultStudentPassword(row.studentId), 12),
      role: "STUDENT" as const,
      mustChangePassword: true,
      ...profile(row),
    })));

    await prisma.$transaction([
      ...(createData.length ? [prisma.user.createMany({ data: createData, skipDuplicates: true })] : []),
      ...updateRows.map((row) => {
        const existingUser = existingMap.get(row.studentId)!;
        return prisma.user.update({ where: { id: existingUser.id }, data: { username: row.studentId, ...profile(row) } });
      }),
    ]);

    const usableStudents = ids.length
      ? await prisma.user.findMany({
          where: {
            role: "STUDENT",
            OR: ids.map((username) => ({ username: { equals: username, mode: "insensitive" as const } })),
          },
          select: { id: true, username: true },
          orderBy: { username: "asc" },
        })
      : [];

    return NextResponse.json({
      ok: true,
      createdCount: newRows.length,
      existingCount: updateRows.length,
      skippedCount: duplicateCount + invalidCount + conflictCount,
      duplicateCount,
      invalidCount,
      conflictCount,
      users: usableStudents,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Excel名單匯入失敗" }, { status: 400 });
  }
}
