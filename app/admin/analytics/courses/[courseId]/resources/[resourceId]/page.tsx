import { notFound } from "next/navigation";
import ResourceAnalyticsDashboard from "@/components/analytics/ResourceAnalyticsDashboard";
import { getResourceAnalyticsData } from "@/lib/analytics/dashboard";

export default async function AdminResourceAnalyticsPage({ params }: { params: Promise<{ courseId: string; resourceId: string }> }) {
  const { courseId, resourceId } = await params;
  const data = await getResourceAnalyticsData(courseId, resourceId);
  if (!data) notFound();
  return <ResourceAnalyticsDashboard data={data} backHref={`/admin/analytics/courses/${courseId}`} highlightHref={`/admin/highlights/${courseId}/${resourceId}`} />;
}
