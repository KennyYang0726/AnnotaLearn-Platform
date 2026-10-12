export type TeachingInsightView = "participation" | "difficulty" | "materials";

export type InsightStudentMetrics = {
  id: string;
  username: string;
  displayName: string | null;
  activeDays: number;
  resourceCoveragePercent: number;
  pageCoveragePercent: number | null;
  dwellSeconds: number;
  dwellPerPageSeconds: number;
  revisitRatio: number;
  repeatedPageRatio: number;
  annotationCount: number;
  taskCompletionPercent: number | null;
};

export type ParticipationGroupKey = "no_record" | "lower_participation" | "revisit" | "broad_short" | "typical";

export type ParticipationGroup = {
  key: ParticipationGroupKey;
  title: string;
  description: string;
  method: string;
  students: InsightStudentMetrics[];
};

export type DifficultyStudentRow = InsightStudentMetrics & {
  status: "priority" | "partial" | "none";
  statusLabel: string;
  signalCount: number;
  notUnderstoodPages: number;
  questionAnnotationCount: number;
  longDwellPages: number;
  repeatedReadingHigh: boolean;
  evidence: string[];
};

export type MaterialAttentionPage = {
  page: number;
  readers: number;
  averageDwellSeconds: number;
  visitsPerReader: number;
  notUnderstoodCount: number;
  notUnderstoodRate: number;
  questionAnnotationCount: number;
  questionAnnotationRate: number;
  signals: string[];
};

export type MaterialAttentionResource = {
  id: string;
  title: string;
  sectionTitle: string | null;
  pageCount: number | null;
  readerCount: number;
  multiSignalPageCount: number;
  pages: MaterialAttentionPage[];
};

export type TeachingInsightsData = {
  course: {
    id: string;
    courseCode: string;
    name: string;
    semesterCode: string;
  };
  coverage: {
    enrolledStudents: number;
    studentsWithReading: number;
    analyzedResources: number;
    pageVisits: number;
  };
  participation: {
    comparable: boolean;
    minimumComparableStudents: number;
    groups: ParticipationGroup[];
    allStudents: InsightStudentMetrics[];
  };
  difficulty: {
    rows: DifficultyStudentRow[];
    counts: {
      priority: number;
      partial: number;
      none: number;
    };
  };
  materials: {
    resources: MaterialAttentionResource[];
    totalMultiSignalPages: number;
  };
};
