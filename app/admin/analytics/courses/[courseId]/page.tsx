import { notFound } from "next/navigation";
import CourseAnalyticsDashboard from "@/components/analytics/CourseAnalyticsDashboard";
import { getCourseAnalyticsData } from "@/lib/analytics/dashboard";

export default async function AdminCourseAnalyticsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const data = await getCourseAnalyticsData(courseId);
  if (!data) notFound();
  return <CourseAnalyticsDashboard data={data} resourceBasePath={`/admin/analytics/courses/${courseId}/resources`} studentBasePath={`/admin/analytics/courses/${courseId}/students`} backHref="/admin/analytics" backLabel="返回學習分析課程列表" />;
}
