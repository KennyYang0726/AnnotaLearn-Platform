import { normalizeStudentId } from "@/lib/student-account";

export function defaultStudentPassword(studentId: string) {
  const normalized = normalizeStudentId(studentId);
  return `${normalized}${normalized}!`;
}
