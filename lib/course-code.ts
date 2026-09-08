import { randomBytes } from "node:crypto";

export function generateCourseCode(semesterCode: string) {
  const compact = semesterCode.replace(/[^0-9A-Za-z]/g, "");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `CRS-${compact}-${suffix}`;
}
