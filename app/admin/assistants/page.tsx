import { prisma } from "@/lib/db";
import AssistantManager from "@/components/admin/AssistantManager";

export default async function AssistantsPage() {
  const [courses, assistants] = await Promise.all([
    prisma.course.findMany({
      include: { semester: true },
      orderBy: [{ semester: { code: "desc" } }, { name: "asc" }],
    }),
    prisma.user.findMany({
      where: { role: "TA" },
      include: {
        staffCourses: { select: { courseId: true } },
        _count: { select: { uploadedAssets: true } },
      },
      orderBy: { username: "asc" },
    }),
  ]);

  return <div className="stack">
    <div className="page-head"><h1 className="h1">助教管理</h1><div className="subtle">建立助教帳號並以課程為單位授權，助教不會進入全站管理後台。</div></div>
    <AssistantManager
      courses={courses.map((course) => ({ id: course.id, label: `${course.semester.code} / ${course.name} / ${course.courseCode}` }))}
      assistants={assistants.map((assistant) => ({
        id: assistant.id,
        username: assistant.username,
        displayName: assistant.displayName,
        mustChangePassword: assistant.mustChangePassword,
        assignedCourseIds: assistant.staffCourses.map((item) => item.courseId),
        uploadedAssetCount: assistant._count.uploadedAssets,
      }))}
    />
  </div>;
}
