import { notFound } from "next/navigation";
import TeacherStudentAnalyticsDashboard from "@/components/analytics/TeacherStudentAnalyticsDashboard";
import { getStudentCourseAnalyticsData } from "@/lib/analytics/dashboard";

export default async function AdminStudentAnalyticsPage({ params }: { params: Promise<{ courseId: string; studentId: string }> }) {
  const { courseId, studentId } = await params;
  const data = await getStudentCourseAnalyticsData(courseId, studentId);
  if (!data) notFound();
  return <TeacherStudentAnalyticsDashboard data={data} backHref={`/admin/analytics/courses/${courseId}`} recordHref={(resourceId) => `/admin/submissions/course/${courseId}/resource/${resourceId}/student/${studentId}`} />;
}
