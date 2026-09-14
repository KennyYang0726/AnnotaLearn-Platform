import { notFound } from "next/navigation";
import StudentAnalyticsDashboard from "@/components/analytics/StudentAnalyticsDashboard";
import { requireStudent } from "@/lib/auth/guards";
import { getStudentCourseAnalyticsData } from "@/lib/analytics/dashboard";

export default async function StudentCourseAnalyticsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const student = await requireStudent();
  const { courseId } = await params;
  const data = await getStudentCourseAnalyticsData(courseId, student.id);
  if (!data) notFound();
  return <StudentAnalyticsDashboard data={data} />;
}
