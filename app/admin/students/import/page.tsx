import StudentImportForm from "@/components/admin/StudentImportForm";
import { prisma } from "@/lib/db";

export default async function ImportStudentsPage() {
  const courses = await prisma.course.findMany({
    include: { semester: true },
    orderBy: [{ semester: { code: "desc" } }, { name: "asc" }],
  });
  return <div className="stack">
    <div className="page-head"><h1 className="h1">匯入Excel學生名單</h1></div>
    <StudentImportForm courses={courses.map((course) => ({ id: course.id, name: course.name, courseCode: course.courseCode, semester: course.semester.code }))} />
  </div>;
}
