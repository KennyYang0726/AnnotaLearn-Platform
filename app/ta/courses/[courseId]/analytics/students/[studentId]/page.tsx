import { notFound } from "next/navigation";
import TeacherStudentAnalyticsDashboard from "@/components/analytics/TeacherStudentAnalyticsDashboard";
import { getStudentCourseAnalyticsData } from "@/lib/analytics/dashboard";
import { requireCourseManager } from "@/lib/auth/course-access";

export default async function TaStudentAnalyticsPage({ params }: { params: Promise<{ courseId: string; studentId: string }> }) {
  const { courseId, studentId } = await params;
  const manager = await requireCourseManager(courseId);
  if (manager.role !== "TA") notFound();
  const data = await getStudentCourseAnalyticsData(courseId, studentId);
  if (!data) notFound();
  return <TeacherStudentAnalyticsDashboard data={data} backHref={`/ta/courses/${courseId}/analytics`} recordHref={(resourceId) => `/ta/courses/${courseId}/submissions/${resourceId}/student/${studentId}`} />;
}
