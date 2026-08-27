import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { activityQuery, parseActivityFilters } from "@/lib/activity-filter";

export default async function SubmissionDetailRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ submissionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { submissionId } = await params;
  const submission = await prisma.readingSubmission.findUnique({
    where: { id: submissionId },
    select: { userId: true, resourceId: true, resource: { select: { courseId: true } } },
  });
  if (!submission) notFound();
  const query = activityQuery(parseActivityFilters(await searchParams));
  redirect(`/admin/submissions/course/${submission.resource.courseId}/resource/${submission.resourceId}/student/${submission.userId}${query ? `?${query}` : ""}`);
}
