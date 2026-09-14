export type AnalyticsDailyPoint = {
  date: string;
  label: string;
  value: number;
};

export type AnalyticsSectionRow = {
  id: string;
  title: string;
  resourceCount: number;
  averageProgress: number | null;
  readerCount: number;
};

export type AnalyticsTaskRow = {
  id: string;
  title: string;
  sectionTitle: string | null;
  dueAtLabel: string | null;
  total: number;
  onTime: number;
  late: number;
  pending: number;
  overdue: number;
  upcoming: number;
};

export type AnalyticsResourceRow = {
  id: string;
  title: string;
  sectionTitle: string | null;
  pageCount: number | null;
  readerCount: number;
  averageProgress: number | null;
  submittedCount: number;
  readingTaskEnabled: boolean;
  available: boolean;
};

export type AnalyticsStudentRow = {
  id: string;
  username: string;
  displayName: string | null;
  averageProgress: number | null;
  courseActiveDays: number;
  resourceReadingDays: number;
  dwellSeconds: number;
  noteCount: number;
  highlightCount: number;
  submittedTasks: number;
  taskCount: number;
};

export type CourseAnalyticsData = {
  course: {
    id: string;
    courseCode: string;
    name: string;
    semesterCode: string;
  };
  metrics: {
    enrolledStudents: number;
    readers: number;
    averageProgress: number | null;
    pendingTasks: number;
    courseActiveDays: number;
  };
  dailyReaders: AnalyticsDailyPoint[];
  sections: AnalyticsSectionRow[];
  tasks: AnalyticsTaskRow[];
  resources: AnalyticsResourceRow[];
  students: AnalyticsStudentRow[];
};

export type ResourcePageAnalyticsRow = {
  page: number;
  readers: number;
  averageDwellSeconds: number;
  visitCount: number;
  understood: number;
  notUnderstood: number;
  importantHighlights: number;
  questionHighlights: number;
  keyPointNotes: number;
  questionNotes: number;
};

export type ResourceAnalyticsData = {
  course: {
    id: string;
    name: string;
    semesterCode: string;
  };
  resource: {
    id: string;
    title: string;
    originalName: string;
    pageCount: number | null;
    sectionTitle: string | null;
  };
  metrics: {
    readers: number;
    averageProgress: number | null;
    totalDwellSeconds: number;
    noteCount: number;
    highlightCount: number;
    notUnderstoodResponses: number;
  };
  pages: ResourcePageAnalyticsRow[];
};

export type StudentCourseAnalyticsData = {
  student: {
    id: string;
    username: string;
    displayName: string | null;
  };
  course: {
    id: string;
    name: string;
    semesterCode: string;
  };
  metrics: {
    averageProgress: number | null;
    courseActiveDays: number;
    resourceReadingDays: number;
    pendingTasks: number;
    submittedTasks: number;
    upcomingTasks: number;
  };
  dailyResources: AnalyticsDailyPoint[];
  resources: Array<{
    id: string;
    title: string;
    sectionTitle: string | null;
    progress: number | null;
    visitedPages: number;
    pageCount: number | null;
    readingDays: number;
    dwellSeconds: number;
    noteCount: number;
    highlightCount: number;
    notUnderstoodPages: number[];
    readingTaskEnabled: boolean;
    submitted: boolean;
    submittedLate: boolean;
    overdue: boolean;
    available: boolean;
    dueAtLabel: string | null;
  }>;
};
