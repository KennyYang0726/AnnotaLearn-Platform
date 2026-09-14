import { notFound } from "next/navigation";
import CourseAnalyticsDashboard from "@/components/analytics/CourseAnalyticsDashboard";
import { getCourseAnalyticsData } from "@/lib/analytics/dashboard";
import { requireCourseManager } from "@/lib/auth/course-access";

export default async function TaCourseAnalyticsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const manager = await requireCourseManager(courseId);
  if (manager.role !== "TA") notFound();
  const data = await getCourseAnalyticsData(courseId);
  if (!data) notFound();
  return <CourseAnalyticsDashboard data={data} resourceBasePath={`/ta/courses/${courseId}/analytics/resources`} studentBasePath={`/ta/courses/${courseId}/analytics/students`} backHref={`/ta/courses/${courseId}`} backLabel="返回課程工作區" />;
}
