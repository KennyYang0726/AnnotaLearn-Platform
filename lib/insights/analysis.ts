import "server-only";

import { prisma } from "@/lib/db";
import type {
  DifficultyStudentRow,
  InsightStudentMetrics,
  MaterialAttentionPage,
  ParticipationGroup,
  ParticipationGroupKey,
  TeachingInsightsData,
} from "@/lib/insights/types";

const MIN_COMPARABLE_STUDENTS = 5;

// 研究設計依據：
// 1. 教師端洞察應將學習歷程轉成可解釋、可追溯的行為資訊，而非只提供原始資料。
//    Wiley et al. (2024), https://doi.org/10.1111/bjet.13383
// 2. 數位學習trace data可用於辨識不同的行為參與樣態。
//    Lee et al. (2026), https://doi.org/10.1016/j.lindif.2026.102914
// 3. 數位劃記與註記可作為閱讀處理與後設認知監控的歷程線索。
//    List & Lin (2023), https://doi.org/10.1016/j.compedu.2023.104791
// 4. 重讀可能是有效理解策略，因此只作輔助線索，不單獨視為閱讀困難。
//    Chevet et al. (2022), https://doi.org/10.1016/j.learninstruc.2021.101565
//
// Q25/Q75是本系統為了提供「班內相對位置」而採用的透明探索性門檻，
// 並非上述研究提出的教育診斷cutoff，也不宣稱可直接推論動機、能力或學習成效。

function pairKey(userId: string, resourceId: string) {
  return `${userId}:${resourceId}`;
}

function pageKey(resourceId: string, page: number) {
  return `${resourceId}:${page}`;
}

function studentPageKey(userId: string, resourceId: string, page: number) {
  return `${userId}:${resourceId}:${page}`;
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const next = sorted[base + 1];
  return next == null ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

function hasVariation(values: number[]) {
  if (values.length < 2) return false;
  return Math.max(...values) > Math.min(...values);
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function roundedRatio(value: number) {
  return Math.round(value * 100) / 100;
}

function groupMeta(key: ParticipationGroupKey): Omit<ParticipationGroup, "students"> {
  if (key === "no_record") {
    return {
      key,
      title: "尚無閱讀紀錄",
      description: "目前沒有產生任何教材頁面閱讀紀錄",
      method: "PageVisit為0，不推論學生動機或能力",
    };
  }
  if (key === "lower_participation") {
    return {
      key,
      title: "閱讀參與較少",
      description: "多項閱讀量指標同時位於班級較低區間",
      method: "在有差異的活動天數、教材涵蓋、頁面涵蓋與總停留時間中，多數指標落在班級後25%",
    };
  }
  if (key === "revisit") {
    return {
      key,
      title: "反覆閱讀較多",
      description: "頁面回訪程度位於班級較高區間，且每頁停留時間不低",
      method: "回訪指標位於班級前25%，同時每頁停留時間至少達班級中位數",
    };
  }
  if (key === "broad_short") {
    return {
      key,
      title: "廣泛瀏覽且停留較短",
      description: "頁面涵蓋較高，但每頁停留時間相對較短",
      method: "頁面涵蓋位於班級前25%，每頁停留時間位於班級後25%，回訪程度未高於班級中位數",
    };
  }
  return {
    key,
    title: "一般閱讀樣態",
    description: "目前未形成前述多重行為線索",
    method: "保留為描述性群組，不將未命中規則解讀為較佳或較差",
  };
}

export async function getTeachingInsightsData(courseId: string): Promise<TeachingInsightsData | null> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      semester: true,
      enrollments: { include: { user: true }, orderBy: { user: { username: "asc" } } },
      resources: {
        include: { asset: true, section: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!course) return null;

  const now = new Date();
  const resources = course.resources.filter((resource) => !resource.readingTaskEnabled || !resource.availableFrom || resource.availableFrom <= now);
  const resourceIds = resources.map((resource) => resource.id);
  const userIds = course.enrollments.map((enrollment) => enrollment.userId);

  const [visits, resourceDays, submissions, understandingStates] = await Promise.all([
    resourceIds.length && userIds.length
      ? prisma.pageVisit.findMany({
          where: { resourceId: { in: resourceIds }, userId: { in: userIds } },
          select: { userId: true, resourceId: true, page: true, durationSeconds: true },
        })
      : [],
    resourceIds.length && userIds.length
      ? prisma.resourceDailyActivity.findMany({
          where: { resourceId: { in: resourceIds }, userId: { in: userIds } },
          select: { userId: true, resourceId: true, activityDate: true },
        })
      : [],
    resourceIds.length && userIds.length
      ? prisma.readingSubmission.findMany({
          where: { resourceId: { in: resourceIds }, userId: { in: userIds } },
          select: {
            userId: true,
            resourceId: true,
            status: true,
            notes: { select: { page: true, type: true } },
            highlights: { select: { page: true, type: true } },
          },
        })
      : [],
    resourceIds.length && userIds.length
      ? prisma.pageUnderstandingState.findMany({
          where: { resourceId: { in: resourceIds }, userId: { in: userIds } },
          select: { userId: true, resourceId: true, page: true, status: true },
        })
      : [],
  ]);

  const availableTaskResources = resources.filter((resource) => resource.readingTaskEnabled);
  const submissionByPair = new Map(submissions.map((submission) => [pairKey(submission.userId, submission.resourceId), submission]));

  const visitsByUser = new Map<string, typeof visits>();
  const visitCountsByStudentPage = new Map<string, number>();
  const dwellByStudentPage = new Map<string, number>();
  const pageVisitCounts = new Map<string, number>();
  const pageReaders = new Map<string, Set<string>>();
  const pageDwellByUser = new Map<string, Map<string, number>>();

  for (const visit of visits) {
    visitsByUser.set(visit.userId, [...(visitsByUser.get(visit.userId) ?? []), visit]);
    const studentPage = studentPageKey(visit.userId, visit.resourceId, visit.page);
    visitCountsByStudentPage.set(studentPage, (visitCountsByStudentPage.get(studentPage) ?? 0) + 1);
    dwellByStudentPage.set(studentPage, (dwellByStudentPage.get(studentPage) ?? 0) + visit.durationSeconds);

    const page = pageKey(visit.resourceId, visit.page);
    pageVisitCounts.set(page, (pageVisitCounts.get(page) ?? 0) + 1);
    const readers = pageReaders.get(page) ?? new Set<string>();
    readers.add(visit.userId);
    pageReaders.set(page, readers);
    const dwellMap = pageDwellByUser.get(page) ?? new Map<string, number>();
    dwellMap.set(visit.userId, (dwellMap.get(visit.userId) ?? 0) + visit.durationSeconds);
    pageDwellByUser.set(page, dwellMap);
  }

  const activeDaysByUser = new Map<string, Set<string>>();
  for (const row of resourceDays) {
    const set = activeDaysByUser.get(row.userId) ?? new Set<string>();
    set.add(row.activityDate.toISOString().slice(0, 10));
    activeDaysByUser.set(row.userId, set);
  }

  const annotationsByUser = new Map<string, number>();
  const questionAnnotationsByUser = new Map<string, number>();
  const questionAnnotationsByPage = new Map<string, number>();
  for (const submission of submissions) {
    const annotationCount = submission.notes.length + submission.highlights.length;
    annotationsByUser.set(submission.userId, (annotationsByUser.get(submission.userId) ?? 0) + annotationCount);

    const questionNotes = submission.notes.filter((note) => note.type === "QUESTION");
    const questionHighlights = submission.highlights.filter((highlight) => highlight.type === "QUESTION");
    const questionCount = questionNotes.length + questionHighlights.length;
    questionAnnotationsByUser.set(submission.userId, (questionAnnotationsByUser.get(submission.userId) ?? 0) + questionCount);

    for (const note of questionNotes) {
      const key = pageKey(submission.resourceId, note.page);
      questionAnnotationsByPage.set(key, (questionAnnotationsByPage.get(key) ?? 0) + 1);
    }
    for (const highlight of questionHighlights) {
      const key = pageKey(submission.resourceId, highlight.page);
      questionAnnotationsByPage.set(key, (questionAnnotationsByPage.get(key) ?? 0) + 1);
    }
  }

  const notUnderstoodByUser = new Map<string, number>();
  const notUnderstoodByPage = new Map<string, number>();
  for (const state of understandingStates) {
    if (state.status !== "NOT_UNDERSTOOD") continue;
    notUnderstoodByUser.set(state.userId, (notUnderstoodByUser.get(state.userId) ?? 0) + 1);
    const key = pageKey(state.resourceId, state.page);
    notUnderstoodByPage.set(key, (notUnderstoodByPage.get(key) ?? 0) + 1);
  }

  const pageLongDwellThresholds = new Map<string, number>();
  const pageLongDwellMedians = new Map<string, number>();
  for (const [key, dwellMap] of pageDwellByUser) {
    const values = [...dwellMap.values()];
    if (values.length < 3 || !hasVariation(values)) continue;
    pageLongDwellThresholds.set(key, quantile(values, 0.75));
    pageLongDwellMedians.set(key, quantile(values, 0.5));
  }

  const studentMetrics: InsightStudentMetrics[] = course.enrollments.map((enrollment) => {
    const studentVisits = visitsByUser.get(enrollment.userId) ?? [];
    const distinctPages = new Set(studentVisits.filter((visit) => visit.page > 0).map((visit) => pageKey(visit.resourceId, visit.page)));
    const visitedResources = new Set(studentVisits.map((visit) => visit.resourceId));
    const dwellSeconds = studentVisits.reduce((sum, visit) => sum + visit.durationSeconds, 0);
    const repeatedPages = [...distinctPages].filter((key) => {
      const [resourceId, pageRaw] = key.split(":");
      return (visitCountsByStudentPage.get(studentPageKey(enrollment.userId, resourceId, Number(pageRaw))) ?? 0) >= 2;
    }).length;

    let visitedKnownPages = 0;
    let totalKnownPages = 0;
    for (const resource of resources) {
      if (!resource.asset.pageCount || resource.asset.pageCount <= 0) continue;
      totalKnownPages += resource.asset.pageCount;
      const visited = new Set(studentVisits.filter((visit) => visit.resourceId === resource.id && visit.page > 0).map((visit) => visit.page));
      visitedKnownPages += Math.min(visited.size, resource.asset.pageCount);
    }

    const submittedTasks = availableTaskResources.filter((resource) => submissionByPair.get(pairKey(enrollment.userId, resource.id))?.status === "SUBMITTED").length;

    return {
      id: enrollment.userId,
      username: enrollment.user.username,
      displayName: enrollment.user.displayName,
      activeDays: activeDaysByUser.get(enrollment.userId)?.size ?? 0,
      resourceCoveragePercent: percentage(visitedResources.size, resources.length),
      pageCoveragePercent: totalKnownPages ? percentage(visitedKnownPages, totalKnownPages) : null,
      dwellSeconds,
      dwellPerPageSeconds: distinctPages.size ? Math.round(dwellSeconds / distinctPages.size) : 0,
      revisitRatio: distinctPages.size ? roundedRatio(studentVisits.length / distinctPages.size) : 0,
      repeatedPageRatio: distinctPages.size ? roundedRatio(repeatedPages / distinctPages.size) : 0,
      annotationCount: annotationsByUser.get(enrollment.userId) ?? 0,
      taskCompletionPercent: availableTaskResources.length ? percentage(submittedTasks, availableTaskResources.length) : null,
    };
  });

  const visitsByStudentId = new Map(course.enrollments.map((enrollment) => [enrollment.userId, visitsByUser.get(enrollment.userId) ?? []]));
  const distributions = {
    activeDays: studentMetrics.map((student) => student.activeDays),
    resourceCoverage: studentMetrics.map((student) => student.resourceCoveragePercent),
    pageCoverage: studentMetrics.map((student) => student.pageCoveragePercent ?? 0),
    dwellSeconds: studentMetrics.map((student) => student.dwellSeconds),
    dwellPerPage: studentMetrics.map((student) => student.dwellPerPageSeconds),
    revisitRatio: studentMetrics.map((student) => student.revisitRatio),
    repeatedPageRatio: studentMetrics.map((student) => student.repeatedPageRatio),
  };

  const q25 = {
    activeDays: quantile(distributions.activeDays, 0.25),
    resourceCoverage: quantile(distributions.resourceCoverage, 0.25),
    pageCoverage: quantile(distributions.pageCoverage, 0.25),
    dwellSeconds: quantile(distributions.dwellSeconds, 0.25),
    dwellPerPage: quantile(distributions.dwellPerPage, 0.25),
  };
  const median = {
    dwellPerPage: quantile(distributions.dwellPerPage, 0.5),
    revisitRatio: quantile(distributions.revisitRatio, 0.5),
  };
  const q75 = {
    pageCoverage: quantile(distributions.pageCoverage, 0.75),
    revisitRatio: quantile(distributions.revisitRatio, 0.75),
    repeatedPageRatio: quantile(distributions.repeatedPageRatio, 0.75),
  };

  const comparable = studentMetrics.length >= MIN_COMPARABLE_STUDENTS;
  const groupBuckets = new Map<ParticipationGroupKey, InsightStudentMetrics[]>([
    ["no_record", []],
    ["lower_participation", []],
    ["revisit", []],
    ["broad_short", []],
    ["typical", []],
  ]);

  for (const student of studentMetrics) {
    const studentVisits = visitsByStudentId.get(student.id) ?? [];
    if (!studentVisits.length) {
      groupBuckets.get("no_record")?.push(student);
      continue;
    }

    if (!comparable) {
      groupBuckets.get("typical")?.push(student);
      continue;
    }

    const lowChecks = [
      hasVariation(distributions.activeDays) ? student.activeDays <= q25.activeDays : null,
      hasVariation(distributions.resourceCoverage) ? student.resourceCoveragePercent <= q25.resourceCoverage : null,
      hasVariation(distributions.pageCoverage) ? (student.pageCoveragePercent ?? 0) <= q25.pageCoverage : null,
      hasVariation(distributions.dwellSeconds) ? student.dwellSeconds <= q25.dwellSeconds : null,
    ].filter((value): value is boolean => value != null);
    const lowThreshold = Math.max(2, Math.ceil(lowChecks.length * 0.6));
    const lowParticipation = lowChecks.length >= 2 && lowChecks.filter(Boolean).length >= lowThreshold;

    const revisitHigh = hasVariation(distributions.revisitRatio) && student.revisitRatio >= q75.revisitRatio && student.revisitRatio > median.revisitRatio;
    const repeatedHigh = hasVariation(distributions.repeatedPageRatio) && student.repeatedPageRatio >= q75.repeatedPageRatio;
    const dwellNotLow = student.dwellPerPageSeconds >= median.dwellPerPage;
    const revisitPattern = (revisitHigh || repeatedHigh) && dwellNotLow;

    const broadCoverage = hasVariation(distributions.pageCoverage) && (student.pageCoveragePercent ?? 0) >= q75.pageCoverage;
    const shortDwell = hasVariation(distributions.dwellPerPage) && student.dwellPerPageSeconds <= q25.dwellPerPage;
    const broadShortPattern = broadCoverage && shortDwell && student.revisitRatio <= median.revisitRatio;

    const key: ParticipationGroupKey = lowParticipation
      ? "lower_participation"
      : revisitPattern
        ? "revisit"
        : broadShortPattern
          ? "broad_short"
          : "typical";
    groupBuckets.get(key)?.push(student);
  }

  const participationGroups: ParticipationGroup[] = (["no_record", "lower_participation", "revisit", "broad_short", "typical"] as ParticipationGroupKey[])
    .map((key) => ({ ...groupMeta(key), students: groupBuckets.get(key) ?? [] }));

  const difficultyRows: DifficultyStudentRow[] = studentMetrics.map((student) => {
    const studentVisits = visitsByStudentId.get(student.id) ?? [];
    const distinctStudentPages = new Set(studentVisits.filter((visit) => visit.page > 0).map((visit) => pageKey(visit.resourceId, visit.page)));
    let longDwellPages = 0;
    for (const key of distinctStudentPages) {
      const threshold = pageLongDwellThresholds.get(key);
      const medianValue = pageLongDwellMedians.get(key);
      if (threshold == null || medianValue == null || threshold <= medianValue) continue;
      const [resourceId, pageRaw] = key.split(":");
      const dwell = dwellByStudentPage.get(studentPageKey(student.id, resourceId, Number(pageRaw))) ?? 0;
      if (dwell >= threshold) longDwellPages += 1;
    }

    const repeatedReadingHigh = comparable
      && hasVariation(distributions.repeatedPageRatio)
      && student.repeatedPageRatio >= q75.repeatedPageRatio
      && student.repeatedPageRatio > 0;
    const notUnderstoodPages = notUnderstoodByUser.get(student.id) ?? 0;
    const questionAnnotationCount = questionAnnotationsByUser.get(student.id) ?? 0;
    const directSignalCount = Number(notUnderstoodPages > 0) + Number(questionAnnotationCount > 0);
    const behavioralSignalCount = Number(longDwellPages > 0) + Number(repeatedReadingHigh);
    const signalCount = directSignalCount + behavioralSignalCount;
    const status: DifficultyStudentRow["status"] = directSignalCount >= 2 || (directSignalCount >= 1 && behavioralSignalCount >= 1)
      ? "priority"
      : signalCount > 0
        ? "partial"
        : "none";
    const evidence = [
      notUnderstoodPages > 0 ? `目前有${notUnderstoodPages}頁標示「我不懂」` : null,
      questionAnnotationCount > 0 ? `目前有${questionAnnotationCount}筆疑問筆記或疑問劃記` : null,
      longDwellPages > 0 ? `${longDwellPages}頁的停留時間位於該頁班級較高區間` : null,
      repeatedReadingHigh ? "重複閱讀比例位於班級較高區間" : null,
    ].filter((value): value is string => Boolean(value));

    return {
      ...student,
      status,
      statusLabel: status === "priority" ? "需優先關注" : status === "partial" ? "具有部分線索" : "目前無明顯線索",
      signalCount,
      notUnderstoodPages,
      questionAnnotationCount,
      longDwellPages,
      repeatedReadingHigh,
      evidence,
    };
  }).sort((a, b) => {
    const rank: Record<DifficultyStudentRow["status"], number> = { priority: 0, partial: 1, none: 2 };
    return rank[a.status] - rank[b.status] || b.signalCount - a.signalCount || a.username.localeCompare(b.username);
  });

  const materialResources = resources.map((resource) => {
    const observedPages = new Set<number>();
    for (const visit of visits) if (visit.resourceId === resource.id && visit.page > 0) observedPages.add(visit.page);
    for (const state of understandingStates) if (state.resourceId === resource.id && state.page > 0) observedPages.add(state.page);
    for (const submission of submissions) {
      if (submission.resourceId !== resource.id) continue;
      for (const note of submission.notes) if (note.page > 0) observedPages.add(note.page);
      for (const highlight of submission.highlights) if (highlight.page > 0) observedPages.add(highlight.page);
    }

    const pageNumbers = resource.asset.pageCount
      ? Array.from({ length: resource.asset.pageCount }, (_, index) => index + 1)
      : [...observedPages].sort((a, b) => a - b);

    const rawPages = pageNumbers.map((page) => {
      const key = pageKey(resource.id, page);
      const readers = pageReaders.get(key)?.size ?? 0;
      const visitCount = pageVisitCounts.get(key) ?? 0;
      const dwellValues = [...(pageDwellByUser.get(key)?.values() ?? [])];
      const notUnderstoodCount = notUnderstoodByPage.get(key) ?? 0;
      const questionAnnotationCount = questionAnnotationsByPage.get(key) ?? 0;
      return {
        page,
        readers,
        averageDwellSeconds: readers ? Math.round(average(dwellValues)) : 0,
        visitsPerReader: readers ? roundedRatio(visitCount / readers) : 0,
        notUnderstoodCount,
        notUnderstoodRate: readers ? notUnderstoodCount / readers : 0,
        questionAnnotationCount,
        questionAnnotationRate: readers ? questionAnnotationCount / readers : 0,
      };
    });

    const minReaders = Math.min(3, Math.max(1, course.enrollments.length));
    const comparablePages = rawPages.filter((page) => page.readers >= minReaders);
    const dwellValues = comparablePages.map((page) => page.averageDwellSeconds);
    const revisitValues = comparablePages.map((page) => page.visitsPerReader);
    const notUnderstoodRates = comparablePages.map((page) => page.notUnderstoodRate);
    const questionRates = comparablePages.map((page) => page.questionAnnotationRate);
    const dwellQ75 = quantile(dwellValues, 0.75);
    const revisitQ75 = quantile(revisitValues, 0.75);
    const notUnderstoodQ75 = quantile(notUnderstoodRates, 0.75);
    const questionQ75 = quantile(questionRates, 0.75);

    const pages: MaterialAttentionPage[] = rawPages.map((page) => {
      const comparablePage = page.readers >= minReaders;
      const signals = [
        comparablePage && page.averageDwellSeconds > 0 && hasVariation(dwellValues) && page.averageDwellSeconds >= dwellQ75 ? "平均停留時間較高" : null,
        comparablePage && page.visitsPerReader > 1 && hasVariation(revisitValues) && page.visitsPerReader >= revisitQ75 ? "重複造訪較多" : null,
        comparablePage && page.notUnderstoodCount > 0 && page.notUnderstoodRate >= notUnderstoodQ75 ? "不理解回報較集中" : null,
        comparablePage && page.questionAnnotationCount > 0 && page.questionAnnotationRate >= questionQ75 ? "疑問註記較集中" : null,
      ].filter((value): value is string => Boolean(value));
      return { ...page, signals };
    });

    return {
      id: resource.id,
      title: resource.title,
      sectionTitle: resource.section?.title ?? null,
      pageCount: resource.asset.pageCount,
      readerCount: new Set(visits.filter((visit) => visit.resourceId === resource.id).map((visit) => visit.userId)).size,
      multiSignalPageCount: pages.filter((page) => page.signals.length >= 2).length,
      pages: pages.filter((page) => page.signals.length > 0).sort((a, b) => b.signals.length - a.signals.length || b.notUnderstoodCount - a.notUnderstoodCount || b.questionAnnotationCount - a.questionAnnotationCount || a.page - b.page),
    };
  });

  return {
    course: {
      id: course.id,
      courseCode: course.courseCode,
      name: course.name,
      semesterCode: course.semester.code,
    },
    coverage: {
      enrolledStudents: userIds.length,
      studentsWithReading: new Set(visits.map((visit) => visit.userId)).size,
      analyzedResources: resources.length,
      pageVisits: visits.length,
    },
    participation: {
      comparable,
      minimumComparableStudents: MIN_COMPARABLE_STUDENTS,
      groups: participationGroups,
      allStudents: studentMetrics,
    },
    difficulty: {
      rows: difficultyRows,
      counts: {
        priority: difficultyRows.filter((row) => row.status === "priority").length,
        partial: difficultyRows.filter((row) => row.status === "partial").length,
        none: difficultyRows.filter((row) => row.status === "none").length,
      },
    },
    materials: {
      resources: materialResources,
      totalMultiSignalPages: materialResources.reduce((sum, resource) => sum + resource.multiSignalPageCount, 0),
    },
  };
}
