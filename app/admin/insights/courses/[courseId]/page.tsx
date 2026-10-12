import { notFound } from "next/navigation";
import TeachingInsightsDashboard from "@/components/insights/TeachingInsightsDashboard";
import { getTeachingInsightsData } from "@/lib/insights/analysis";
import type { TeachingInsightView } from "@/lib/insights/types";

function normalizeView(value: string | string[] | undefined): TeachingInsightView {
  const selected = Array.isArray(value) ? value[0] : value;
  if (selected === "difficulty" || selected === "materials") return selected;
  return "participation";
}

export default async function AdminTeachingInsightsCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const [{ courseId }, query] = await Promise.all([params, searchParams]);
  const data = await getTeachingInsightsData(courseId);
  if (!data) notFound();
  return <TeachingInsightsDashboard data={data} view={normalizeView(query.view)} />;
}
