import "server-only";

export const DEFAULT_APP_TIME_ZONE = "Asia/Taipei";

function resolveAppTimeZone() {
  const value = process.env.APP_TIMEZONE?.trim() || DEFAULT_APP_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return value;
  } catch {
    throw new Error(`Invalid APP_TIMEZONE: ${value}. Use an IANA timezone such as Asia/Taipei.`);
  }
}

export const APP_TIME_ZONE = resolveAppTimeZone();

type DateLike = Date | string;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function toDate(value: DateLike) {
  return typeof value === "string" ? new Date(value) : value;
}

function zonedParts(date: Date): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: "year" | "month" | "day" | "hour" | "minute" | "second") => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function timeZoneOffsetMs(date: Date) {
  const parts = zonedParts(date);
  const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const wholeSecondTimestamp = Math.floor(date.getTime() / 1000) * 1000;
  return representedAsUtc - wholeSecondTimestamp;
}

export function appDateKey(value: DateLike) {
  const date = toDate(value);
  const parts = zonedParts(date);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function appDateAsDbDate(value: DateLike) {
  return new Date(`${appDateKey(value)}T00:00:00.000Z`);
}

export function parseAppDateTimeLocal(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;

  const wallTimeAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let candidate = new Date(wallTimeAsUtc);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    candidate = new Date(wallTimeAsUtc - timeZoneOffsetMs(candidate));
  }

  return formatAppDateTimeInput(candidate) === value ? candidate : null;
}

export function formatAppDateTimeInput(value: DateLike) {
  const parts = zonedParts(toDate(value));
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function addDaysToDateKey(value: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function appDateRangeStart(value: string) {
  return parseAppDateTimeLocal(`${value}T00:00`);
}

export function appDateRangeEnd(value: string) {
  const nextDate = addDaysToDateKey(value, 1);
  const nextStart = nextDate ? parseAppDateTimeLocal(`${nextDate}T00:00`) : null;
  return nextStart ? new Date(nextStart.getTime() - 1) : null;
}

export function formatAppDate(value: DateLike) {
  return appDateKey(value);
}

export function formatDbDateOnly(value: DateLike) {
  const date = toDate(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function formatAppDateTime(value: DateLike) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(toDate(value));
}

export function formatAppDateTimeDisplay(value: DateLike, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("zh-TW", {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).format(toDate(value));
}
