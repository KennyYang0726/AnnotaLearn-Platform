import StudentForm from "@/components/admin/StudentForm";
import { prisma } from "@/lib/db";

export default async function NewStudentPage() {
  const courses = await prisma.course.findMany({ include: { semester: true }, orderBy: [{ semester: { code: "desc" } }, { name: "asc" }] });
  return <div className="stack"><div className="page-head"><h1 className="h1">新增學生</h1></div><section className="card panel" style={{ maxWidth: 720 }}><StudentForm courses={courses.map((course) => ({ id: course.id, name: course.name, semester: course.semester.code, courseCode: course.courseCode }))} /></section></div>;
}
