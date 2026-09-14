import "server-only";

import { prisma } from "@/lib/db";
import { appDateKey, formatAppDateTimeDisplay, formatDbDateOnly } from "@/lib/app-timezone";
import { browsingProgressPercent, distinctVisitedPages } from "@/lib/reading-analytics";
import type {
  CourseAnalyticsData,
  ResourceAnalyticsData,
  StudentCourseAnalyticsData,
} from "@/lib/analytics/types";

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function dateKeyOffset(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function recentDateKeys(days = 30) {
  const today = appDateKey(new Date());
  return Array.from({ length: days }, (_, index) => dateKeyOffset(today, index - days + 1));
}

function shortDateLabel(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function pairKey(userId: string, resourceId: string) {
  return `${userId}:${resourceId}`;
}

function buildVisitedPageSets(visits: Array<{ userId: string; resourceId: string; page: number }>) {
  const result = new Map<string, Set<number>>();
  for (const visit of visits) {
    const key = pairKey(visit.userId, visit.resourceId);
    const pages = result.get(key) ?? new Set<number>();
    if (visit.page > 0) pages.add(visit.page);
    result.set(key, pages);
  }
  return result;
}

export async function getCourseAnalyticsData(courseId: string): Promise<CourseAnalyticsData | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      semester: true,
      enrollments: { include: { user: true }, orderBy: { user: { username: "asc" } } },
      sections: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      resources: { include: { asset: true, section: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!course) return null;

  const userIds = course.enrollments.map((enrollment) => enrollment.userId);
  const resourceIds = course.resources.map((resource) => resource.id);
  const now = new Date();
  const availableResourceIds = new Set(course.resources.filter((resource) => !resource.readingTaskEnabled || !resource.availableFrom || resource.availableFrom <= now).map((resource) => resource.id));
  const recentKeys = recentDateKeys(30);
  const recentStart = new Date(`${recentKeys[0]}T00:00:00.000Z`);
  const recentEnd = new Date(`${recentKeys.at(-1)}T23:59:59.999Z`);

  const [visits, recentResourceDays, courseDays, resourceDays, submissions] = await Promise.all([
    resourceIds.length && userIds.length
      ? prisma.pageVisit.findMany({
          where: { resourceId: { in: resourceIds }, userId: { in: userIds } },
          select: { userId: true, resourceId: true, page: true, durationSeconds: true },
        })
      : [],
    resourceIds.length && userIds.length
      ? prisma.resourceDailyActivity.findMany({
          where: { resourceId: { in: resourceIds }, userId: { in: userIds }, activityDate: { gte: recentStart, lte: recentEnd } },
          select: { resourceId: true, userId: true, activityDate: true },
        })
      : [],
    userIds.length
      ? prisma.courseDailyActivity.findMany({
          where: { courseId, userId: { in: userIds } },
          select: { userId: true, activityDate: true },
        })
      : [],
    resourceIds.length && userIds.length
      ? prisma.resourceDailyActivity.findMany({
          where: { resourceId: { in: resourceIds }, userId: { in: userIds } },
          select: { resourceId: true, userId: true, activityDate: true },
        })
      : [],
    resourceIds.length && userIds.length
      ? prisma.readingSubmission.findMany({
          where: { resourceId: { in: resourceIds }, userId: { in: userIds } },
          select: {
            userId: true,
            resourceId: true,
            status: true,
            firstSubmittedAt: true,
            lastSubmittedAt: true,
            submittedAt: true,
            _count: { select: { notes: true, highlights: true } },
          },
        })
      : [],
  ]);

  const visitedSets = buildVisitedPageSets(visits);
  const submissionByPair = new Map(submissions.map((submission) => [pairKey(submission.userId, submission.resourceId), submission]));
  const progressByPair = new Map<string, number | null>();

  for (const userId of userIds) {
    for (const resource of course.resources) {
      const count = visitedSets.get(pairKey(userId, resource.id))?.size ?? 0;
      progressByPair.set(pairKey(userId, resource.id), browsingProgressPercent(count, resource.asset.pageCount));
    }
  }

  const readers = new Set(visits.map((visit) => visit.userId)).size;
  const allProgress: number[] = [];
  for (const userId of userIds) {
    for (const resource of course.resources) {
      if (!availableResourceIds.has(resource.id)) continue;
      const value = progressByPair.get(pairKey(userId, resource.id));
      if (value != null) allProgress.push(value);
    }
  }
  const taskResources = course.resources.filter((resource) => resource.readingTaskEnabled);
  const activeTaskResources = taskResources.filter((resource) => !resource.availableFrom || resource.availableFrom <= now);
  let pendingTasks = 0;
  for (const resource of activeTaskResources) {
    for (const userId of userIds) {
      const submission = submissionByPair.get(pairKey(userId, resource.id));
      if (submission?.status !== "SUBMITTED") pendingTasks += 1;
    }
  }

  const dailyReaderSets = new Map<string, Set<string>>(recentKeys.map((key) => [key, new Set()]));
  for (const activity of recentResourceDays) {
    const key = formatDbDateOnly(activity.activityDate);
    dailyReaderSets.get(key)?.add(activity.userId);
  }
  const dailyReaders = recentKeys.map((date) => ({ date, label: shortDateLabel(date), value: dailyReaderSets.get(date)?.size ?? 0 }));

  const sectionRows = [
    ...course.sections.map((section) => ({ id: section.id, title: section.title })),
    ...(course.resources.some((resource) => !resource.sectionId) ? [{ id: "__UNASSIGNED__", title: course.sections.length ? "其他教材" : "教材資源" }] : []),
  ].map((section) => {
    const resources = course.resources.filter((resource) => section.id === "__UNASSIGNED__" ? !resource.sectionId : resource.sectionId === section.id);
    const progressResourceIds = new Set(resources.filter((resource) => availableResourceIds.has(resource.id)).map((resource) => resource.id));
    const progresses: number[] = [];
    const sectionReaders = new Set<string>();
    for (const resource of resources) {
      for (const userId of userIds) {
        const value = progressByPair.get(pairKey(userId, resource.id));
        if (value != null && progressResourceIds.has(resource.id)) progresses.push(value);
        if ((visitedSets.get(pairKey(userId, resource.id))?.size ?? 0) > 0) sectionReaders.add(userId);
      }
    }
    return {
      id: section.id,
      title: section.title,
      resourceCount: resources.length,
      averageProgress: average(progresses),
      readerCount: sectionReaders.size,
    };
  });

  const tasks = taskResources.map((resource) => {
    let onTime = 0;
    let late = 0;
    let pending = 0;
    let overdue = 0;
    let upcoming = 0;
    for (const userId of userIds) {
      const submission = submissionByPair.get(pairKey(userId, resource.id));
      const submitted = submission?.status === "SUBMITTED";
      const firstSubmittedAt = submission?.firstSubmittedAt ?? submission?.lastSubmittedAt ?? submission?.submittedAt ?? null;
      if (submitted) {
        if (resource.dueAt && firstSubmittedAt && firstSubmittedAt > resource.dueAt) late += 1;
        else onTime += 1;
      } else if (resource.availableFrom && resource.availableFrom > now) {
        upcoming += 1;
      } else if (resource.dueAt && resource.dueAt < now) {
        overdue += 1;
      } else {
        pending += 1;
      }
    }
    return {
      id: resource.id,
      title: resource.title,
      sectionTitle: resource.section?.title ?? null,
      dueAtLabel: resource.dueAt ? formatAppDateTimeDisplay(resource.dueAt, { dateStyle: "short", timeStyle: "short" }) : null,
      total: userIds.length,
      onTime,
      late,
      pending,
      overdue,
      upcoming,
    };
  });

  const resources = course.resources.map((resource) => {
    const resourceProgresses: number[] = [];
    const resourceReaders = new Set<string>();
    let submittedCount = 0;
    for (const userId of userIds) {
      const value = progressByPair.get(pairKey(userId, resource.id));
      if (value != null) resourceProgresses.push(value);
      if ((visitedSets.get(pairKey(userId, resource.id))?.size ?? 0) > 0) resourceReaders.add(userId);
      if (submissionByPair.get(pairKey(userId, resource.id))?.status === "SUBMITTED") submittedCount += 1;
    }
    const available = availableResourceIds.has(resource.id);
    return {
      id: resource.id,
      title: resource.title,
      sectionTitle: resource.section?.title ?? null,
      pageCount: resource.asset.pageCount,
      readerCount: resourceReaders.size,
      averageProgress: available ? average(resourceProgresses) : null,
      submittedCount,
      readingTaskEnabled: resource.readingTaskEnabled,
      available,
    };
  });

  const courseDaysByUser = new Map<string, Set<string>>();
  for (const activity of courseDays) {
    const set = courseDaysByUser.get(activity.userId) ?? new Set<string>();
    set.add(formatDbDateOnly(activity.activityDate));
    courseDaysByUser.set(activity.userId, set);
  }
  const resourceDaysByUser = new Map<string, Set<string>>();
  for (const activity of resourceDays) {
    const set = resourceDaysByUser.get(activity.userId) ?? new Set<string>();
    set.add(formatDbDateOnly(activity.activityDate));
    resourceDaysByUser.set(activity.userId, set);
  }
  const dwellByUser = new Map<string, number>();
  for (const visit of visits) dwellByUser.set(visit.userId, (dwellByUser.get(visit.userId) ?? 0) + visit.durationSeconds);

  const students = course.enrollments.map((enrollment) => {
    const progresses = course.resources
      .filter((resource) => availableResourceIds.has(resource.id))
      .map((resource) => progressByPair.get(pairKey(enrollment.userId, resource.id)))
      .filter((value): value is number => value != null);
    const studentSubmissions = submissions.filter((submission) => submission.userId === enrollment.userId);
    return {
      id: enrollment.userId,
      username: enrollment.user.username,
      displayName: enrollment.user.displayName,
      averageProgress: average(progresses),
      courseActiveDays: courseDaysByUser.get(enrollment.userId)?.size ?? 0,
      resourceReadingDays: resourceDaysByUser.get(enrollment.userId)?.size ?? 0,
      dwellSeconds: dwellByUser.get(enrollment.userId) ?? 0,
      noteCount: studentSubmissions.reduce((sum, submission) => sum + submission._count.notes, 0),
      highlightCount: studentSubmissions.reduce((sum, submission) => sum + submission._count.highlights, 0),
      submittedTasks: activeTaskResources.filter((resource) => submissionByPair.get(pairKey(enrollment.userId, resource.id))?.status === "SUBMITTED").length,
      taskCount: activeTaskResources.length,
    };
  });

  return {
    course: { id: course.id, courseCode: course.courseCode, name: course.name, semesterCode: course.semester.code },
    metrics: {
      enrolledStudents: userIds.length,
      readers,
      averageProgress: average(allProgress),
      pendingTasks,
      courseActiveDays: new Set(courseDays.map((activity) => formatDbDateOnly(activity.activityDate))).size,
    },
    dailyReaders,
    sections: sectionRows,
    tasks,
    resources,
    students,
  };
}

export async function getResourceAnalyticsData(courseId: string, resourceId: string): Promise<ResourceAnalyticsData | null> {
  const resource = await prisma.courseResource.findFirst({
    where: { id: resourceId, courseId },
    include: {
      asset: true,
      section: true,
      course: { include: { semester: true, enrollments: { select: { userId: true } } } },
    },
  });
  if (!resource) return null;

  const userIds = resource.course.enrollments.map((enrollment) => enrollment.userId);
  const [visits, states, submissions] = await Promise.all([
    userIds.length ? prisma.pageVisit.findMany({ where: { resourceId, userId: { in: userIds } }, select: { userId: true, page: true, durationSeconds: true } }) : [],
    userIds.length ? prisma.pageUnderstandingState.findMany({ where: { resourceId, userId: { in: userIds } }, select: { userId: true, page: true, status: true } }) : [],
    userIds.length ? prisma.readingSubmission.findMany({
      where: { resourceId, userId: { in: userIds } },
      select: {
        userId: true,
        notes: { select: { page: true, type: true } },
        highlights: { select: { page: true, type: true } },
      },
    }) : [],
  ]);

  const maxObservedPage = Math.max(0, ...visits.map((visit) => visit.page), ...states.map((state) => state.page), ...submissions.flatMap((submission) => [...submission.notes.map((note) => note.page), ...submission.highlights.map((highlight) => highlight.page)]));
  const pageCount = resource.asset.pageCount ?? maxObservedPage;
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);

  const pages = pageNumbers.map((page) => {
    const pageVisits = visits.filter((visit) => visit.page === page);
    const pageReaders = new Set(pageVisits.map((visit) => visit.userId));
    const totalDwell = pageVisits.reduce((sum, visit) => sum + visit.durationSeconds, 0);
    const pageStates = states.filter((state) => state.page === page);
    const notes = submissions.flatMap((submission) => submission.notes).filter((note) => note.page === page);
    const highlights = submissions.flatMap((submission) => submission.highlights).filter((highlight) => highlight.page === page);
    return {
      page,
      readers: pageReaders.size,
      averageDwellSeconds: pageReaders.size ? Math.round(totalDwell / pageReaders.size) : 0,
      visitCount: pageVisits.length,
      understood: pageStates.filter((state) => state.status === "UNDERSTOOD").length,
      notUnderstood: pageStates.filter((state) => state.status === "NOT_UNDERSTOOD").length,
      importantHighlights: highlights.filter((highlight) => highlight.type === "IMPORTANT").length,
      questionHighlights: highlights.filter((highlight) => highlight.type === "QUESTION").length,
      keyPointNotes: notes.filter((note) => note.type === "KEY_POINT").length,
      questionNotes: notes.filter((note) => note.type === "QUESTION").length,
    };
  });

  const visitedByUser = new Map<string, Array<{ page: number }>>();
  for (const visit of visits) visitedByUser.set(visit.userId, [...(visitedByUser.get(visit.userId) ?? []), visit]);
  const progresses = userIds
    .map((userId) => browsingProgressPercent(distinctVisitedPages(visitedByUser.get(userId) ?? []).length, resource.asset.pageCount))
    .filter((value): value is number => value != null);

  return {
    course: { id: resource.course.id, name: resource.course.name, semesterCode: resource.course.semester.code },
    resource: { id: resource.id, title: resource.title, originalName: resource.asset.originalName, pageCount: resource.asset.pageCount, sectionTitle: resource.section?.title ?? null },
    metrics: {
      readers: new Set(visits.map((visit) => visit.userId)).size,
      averageProgress: average(progresses),
      totalDwellSeconds: visits.reduce((sum, visit) => sum + visit.durationSeconds, 0),
      noteCount: submissions.reduce((sum, submission) => sum + submission.notes.length, 0),
      highlightCount: submissions.reduce((sum, submission) => sum + submission.highlights.length, 0),
      notUnderstoodResponses: states.filter((state) => state.status === "NOT_UNDERSTOOD").length,
    },
    pages,
  };
}

export async function getStudentCourseAnalyticsData(courseId: string, userId: string): Promise<StudentCourseAnalyticsData | null> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: {
      user: true,
      course: {
        include: {
          semester: true,
          resources: { include: { asset: true, section: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        },
      },
    },
  });
  if (!enrollment) return null;
  const course = enrollment.course;
  const resourceIds = course.resources.map((resource) => resource.id);
  const now = new Date();
  const recentKeys = recentDateKeys(30);
  const recentStart = new Date(`${recentKeys[0]}T00:00:00.000Z`);
  const recentEnd = new Date(`${recentKeys.at(-1)}T23:59:59.999Z`);

  const [visits, courseDays, resourceDays, recentResourceDays, states, submissions] = await Promise.all([
    resourceIds.length ? prisma.pageVisit.findMany({ where: { resourceId: { in: resourceIds }, userId }, select: { resourceId: true, page: true, durationSeconds: true } }) : [],
    prisma.courseDailyActivity.findMany({ where: { courseId, userId }, select: { activityDate: true } }),
    resourceIds.length ? prisma.resourceDailyActivity.findMany({ where: { resourceId: { in: resourceIds }, userId }, select: { resourceId: true, activityDate: true } }) : [],
    resourceIds.length ? prisma.resourceDailyActivity.findMany({ where: { resourceId: { in: resourceIds }, userId, activityDate: { gte: recentStart, lte: recentEnd } }, select: { resourceId: true, activityDate: true } }) : [],
    resourceIds.length ? prisma.pageUnderstandingState.findMany({ where: { resourceId: { in: resourceIds }, userId }, select: { resourceId: true, page: true, status: true } }) : [],
    resourceIds.length ? prisma.readingSubmission.findMany({ where: { resourceId: { in: resourceIds }, userId }, select: { resourceId: true, status: true, firstSubmittedAt: true, lastSubmittedAt: true, submittedAt: true, _count: { select: { notes: true, highlights: true } } } }) : [],
  ]);

  const visitMap = new Map<string, typeof visits>();
  for (const visit of visits) visitMap.set(visit.resourceId, [...(visitMap.get(visit.resourceId) ?? []), visit]);
  const resourceDayMap = new Map<string, Set<string>>();
  for (const activity of resourceDays) {
    const set = resourceDayMap.get(activity.resourceId) ?? new Set<string>();
    set.add(formatDbDateOnly(activity.activityDate));
    resourceDayMap.set(activity.resourceId, set);
  }
  const stateMap = new Map<string, typeof states>();
  for (const state of states) stateMap.set(state.resourceId, [...(stateMap.get(state.resourceId) ?? []), state]);
  const submissionMap = new Map(submissions.map((submission) => [submission.resourceId, submission]));

  const resourceRows = course.resources.map((resource) => {
    const resourceVisits = visitMap.get(resource.id) ?? [];
    const visitedPages = distinctVisitedPages(resourceVisits);
    const submission = submissionMap.get(resource.id);
    const available = !resource.readingTaskEnabled || !resource.availableFrom || resource.availableFrom <= now;
    const submitted = submission?.status === "SUBMITTED";
    const firstSubmittedAt = submission?.firstSubmittedAt ?? submission?.lastSubmittedAt ?? submission?.submittedAt ?? null;
    return {
      id: resource.id,
      title: resource.title,
      sectionTitle: resource.section?.title ?? null,
      progress: browsingProgressPercent(visitedPages.length, resource.asset.pageCount),
      visitedPages: visitedPages.length,
      pageCount: resource.asset.pageCount,
      readingDays: resourceDayMap.get(resource.id)?.size ?? 0,
      dwellSeconds: resourceVisits.reduce((sum, visit) => sum + visit.durationSeconds, 0),
      noteCount: submission?._count.notes ?? 0,
      highlightCount: submission?._count.highlights ?? 0,
      notUnderstoodPages: (stateMap.get(resource.id) ?? []).filter((state) => state.status === "NOT_UNDERSTOOD").map((state) => state.page).sort((a, b) => a - b),
      readingTaskEnabled: resource.readingTaskEnabled,
      submitted,
      submittedLate: Boolean(submitted && resource.dueAt && firstSubmittedAt && firstSubmittedAt > resource.dueAt),
      overdue: Boolean(resource.readingTaskEnabled && available && !submitted && resource.dueAt && resource.dueAt < now),
      available,
      dueAtLabel: resource.dueAt ? formatAppDateTimeDisplay(resource.dueAt, { dateStyle: "short", timeStyle: "short" }) : null,
    };
  });

  const dailyResourceSets = new Map<string, Set<string>>(recentKeys.map((key) => [key, new Set()]));
  for (const activity of recentResourceDays) {
    dailyResourceSets.get(formatDbDateOnly(activity.activityDate))?.add(activity.resourceId);
  }

  const taskRows = resourceRows.filter((resource) => resource.readingTaskEnabled);
  const currentTaskRows = taskRows.filter((resource) => resource.available);
  const pendingTasks = currentTaskRows.filter((resource) => !resource.submitted).length;
  const allProgress = resourceRows.filter((resource) => resource.available).map((resource) => resource.progress).filter((value): value is number => value != null);

  return {
    student: { id: enrollment.user.id, username: enrollment.user.username, displayName: enrollment.user.displayName },
    course: { id: course.id, name: course.name, semesterCode: course.semester.code },
    metrics: {
      averageProgress: average(allProgress),
      courseActiveDays: new Set(courseDays.map((activity) => formatDbDateOnly(activity.activityDate))).size,
      resourceReadingDays: new Set(resourceDays.map((activity) => formatDbDateOnly(activity.activityDate))).size,
      pendingTasks,
      submittedTasks: currentTaskRows.filter((resource) => resource.submitted).length,
      upcomingTasks: taskRows.filter((resource) => !resource.available).length,
    },
    dailyResources: recentKeys.map((date) => ({ date, label: shortDateLabel(date), value: dailyResourceSets.get(date)?.size ?? 0 })),
    resources: resourceRows,
  };
}
