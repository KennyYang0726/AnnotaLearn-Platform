import { notFound } from "next/navigation";
import ResourceAnalyticsDashboard from "@/components/analytics/ResourceAnalyticsDashboard";
import { getResourceAnalyticsData } from "@/lib/analytics/dashboard";
import { requireCourseManager } from "@/lib/auth/course-access";

export default async function TaResourceAnalyticsPage({ params }: { params: Promise<{ courseId: string; resourceId: string }> }) {
  const { courseId, resourceId } = await params;
  const manager = await requireCourseManager(courseId);
  if (manager.role !== "TA") notFound();
  const data = await getResourceAnalyticsData(courseId, resourceId);
  if (!data) notFound();
  return <ResourceAnalyticsDashboard data={data} backHref={`/ta/courses/${courseId}/analytics`} highlightHref={`/ta/courses/${courseId}/highlights/${resourceId}`} />;
}
