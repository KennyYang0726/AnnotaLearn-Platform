export type ActivityRecordType = "ALL" | "NOTE" | "HIGHLIGHT" | "UNDERSTANDING" | "VISIT" | "DAILY_ACTIVITY";
export type ActivityNoteType = "ALL" | "KEY_POINT" | "QUESTION";
export type ActivityHighlightColor = "ALL" | "RED" | "YELLOW";
export type ActivityUnderstanding = "ALL" | "UNDERSTOOD" | "NOT_UNDERSTOOD" | "UNSET";
export type ActivityCompletion = "ALL" | "COMPLETE" | "INCOMPLETE" | "NOT_STARTED";

export type ActivityFilters = {
  from: string;
  to: string;
  recordType: ActivityRecordType;
  noteType: ActivityNoteType;
  highlightColor: ActivityHighlightColor;
  understanding: ActivityUnderstanding;
  completion: ActivityCompletion;
  student: string;
  page: number | null;
};

type SearchSource = URLSearchParams | Record<string, string | string[] | undefined>;

function valueOf(source: SearchSource, key: string) {
  if (source instanceof URLSearchParams) return source.get(key) ?? "";
  const value = source[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function validDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function parseActivityFilters(source: SearchSource): ActivityFilters {
  const fromRaw = valueOf(source, "from");
  const toRaw = valueOf(source, "to");
  const recordTypeRaw = valueOf(source, "recordType");
  const noteTypeRaw = valueOf(source, "noteType");
  const highlightColorRaw = valueOf(source, "highlightColor");
  const understandingRaw = valueOf(source, "understanding");
  const completionRaw = valueOf(source, "completion");
  const pageRaw = Number(valueOf(source, "page"));

  return {
    from: validDateInput(fromRaw) ? fromRaw : "",
    to: validDateInput(toRaw) ? toRaw : "",
    recordType:
      recordTypeRaw === "NOTE" ||
      recordTypeRaw === "HIGHLIGHT" ||
      recordTypeRaw === "UNDERSTANDING" ||
      recordTypeRaw === "VISIT" ||
      recordTypeRaw === "DAILY_ACTIVITY"
        ? recordTypeRaw
        : "ALL",
    noteType: noteTypeRaw === "KEY_POINT" || noteTypeRaw === "QUESTION" ? noteTypeRaw : "ALL",
    highlightColor: highlightColorRaw === "RED" || highlightColorRaw === "YELLOW" ? highlightColorRaw : "ALL",
    understanding:
      understandingRaw === "UNDERSTOOD" ||
      understandingRaw === "NOT_UNDERSTOOD" ||
      understandingRaw === "UNSET"
        ? understandingRaw
        : "ALL",
    completion:
      completionRaw === "COMPLETE" || completionRaw === "INCOMPLETE" || completionRaw === "NOT_STARTED"
        ? completionRaw
        : "ALL",
    student: valueOf(source, "student").trim(),
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : null,
  };
}

export function hasRecordFilters(filters: ActivityFilters) {
  return Boolean(
    filters.from ||
      filters.to ||
      filters.recordType !== "ALL" ||
      filters.noteType !== "ALL" ||
      filters.highlightColor !== "ALL" ||
      filters.understanding !== "ALL" ||
      filters.completion !== "ALL" ||
      filters.page,
  );
}

export function hasEventFilters(filters: ActivityFilters) {
  return Boolean(
    filters.from ||
      filters.to ||
      filters.recordType !== "ALL" ||
      filters.noteType !== "ALL" ||
      filters.highlightColor !== "ALL" ||
      filters.page,
  );
}

export function recordedAtWhere(filters: ActivityFilters) {
  const where: { gte?: Date; lte?: Date } = {};
  if (filters.from) where.gte = new Date(`${filters.from}T00:00:00+08:00`);
  if (filters.to) where.lte = new Date(`${filters.to}T23:59:59.999+08:00`);
  return Object.keys(where).length ? where : undefined;
}

export function activityDateWhere(filters: ActivityFilters) {
  const where: { gte?: Date; lte?: Date } = {};
  // PostgreSQL DATE is represented by Prisma as UTC midnight. These values are
  // intentionally date-only and must not be shifted by the server timezone.
  if (filters.from) where.gte = new Date(`${filters.from}T00:00:00.000Z`);
  if (filters.to) where.lte = new Date(`${filters.to}T00:00:00.000Z`);
  return Object.keys(where).length ? where : undefined;
}

export function activityQuery(filters: ActivityFilters) {
  const query = new URLSearchParams();
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.recordType !== "ALL") query.set("recordType", filters.recordType);
  if (filters.noteType !== "ALL") query.set("noteType", filters.noteType);
  if (filters.highlightColor !== "ALL") query.set("highlightColor", filters.highlightColor);
  if (filters.understanding !== "ALL") query.set("understanding", filters.understanding);
  if (filters.completion !== "ALL") query.set("completion", filters.completion);
  if (filters.student) query.set("student", filters.student);
  if (filters.page) query.set("page", String(filters.page));
  return query.toString();
}

export function filterPeriodLabel(filters: ActivityFilters) {
  if (filters.from && filters.to) return `${filters.from}～${filters.to}`;
  if (filters.from) return `${filters.from}起`;
  if (filters.to) return `${filters.to}以前`;
  return "全部日期";
}

export function formatTaipeiDate(date: Date | string) {
  const target = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(target);
  const get = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function formatTaipeiDateTime(date: Date | string) {
  const target = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(target);
}

export function latestDate(values: Date[]) {
  if (values.length === 0) return null;
  return new Date(Math.max(...values.map((value) => value.getTime())));
}
