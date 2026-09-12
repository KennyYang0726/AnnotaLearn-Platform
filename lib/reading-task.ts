export type ReadingTaskWindow = {
  readingTaskEnabled: boolean;
  availableFrom: Date | null;
  dueAt: Date | null;
};

export function isReadingTaskAvailable(resource: ReadingTaskWindow, now = new Date()) {
  return !resource.readingTaskEnabled || !resource.availableFrom || resource.availableFrom <= now;
}

export function isReadingTaskOverdue(resource: ReadingTaskWindow, now = new Date()) {
  return Boolean(resource.readingTaskEnabled && resource.dueAt && resource.dueAt < now);
}
