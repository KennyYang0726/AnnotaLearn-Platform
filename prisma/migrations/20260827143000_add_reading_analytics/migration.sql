-- Course active period
ALTER TABLE "Course" ADD COLUMN "startAt" TIMESTAMP(3);
ALTER TABLE "Course" ADD COLUMN "endAt" TIMESTAMP(3);

-- Preserve compatibility with any local test courses that already exist.
UPDATE "Course"
SET
  "startAt" = date_trunc('day', "createdAt"),
  "endAt" = date_trunc('day', "createdAt") + INTERVAL '90 days' - INTERVAL '1 millisecond'
WHERE "startAt" IS NULL OR "endAt" IS NULL;

ALTER TABLE "Course" ALTER COLUMN "startAt" SET NOT NULL;
ALTER TABLE "Course" ALTER COLUMN "endAt" SET NOT NULL;

-- Per-page comprehension
CREATE TYPE "PageUnderstanding" AS ENUM ('UNDERSTOOD', 'NOT_UNDERSTOOD');

CREATE TABLE "PageUnderstandingState" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "page" INTEGER NOT NULL,
  "status" "PageUnderstanding" NOT NULL,
  "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PageUnderstandingState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PageUnderstandingEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "page" INTEGER NOT NULL,
  "status" "PageUnderstanding" NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PageUnderstandingEvent_pkey" PRIMARY KEY ("id")
);

-- Each visit remains separate. durationSeconds is incremented by heartbeat,
-- so an abandoned tab never turns into an all-day visit.
CREATE TABLE "PageVisit" (
  "id" TEXT NOT NULL,
  "clientVisitId" TEXT NOT NULL,
  "readerSessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "page" INTEGER NOT NULL,
  "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  "durationSeconds" INTEGER NOT NULL DEFAULT 0,
  "endReason" TEXT,
  CONSTRAINT "PageVisit_pkey" PRIMARY KEY ("id")
);

-- One durable row per course/student/Taipei calendar day.
CREATE TABLE "CourseDailyActivity" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "activityDate" DATE NOT NULL,
  "firstActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseDailyActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PageUnderstandingState_userId_resourceId_page_key" ON "PageUnderstandingState"("userId", "resourceId", "page");
CREATE INDEX "PageUnderstandingState_resourceId_page_status_idx" ON "PageUnderstandingState"("resourceId", "page", "status");
CREATE INDEX "PageUnderstandingState_userId_resourceId_idx" ON "PageUnderstandingState"("userId", "resourceId");
CREATE INDEX "PageUnderstandingEvent_resourceId_page_status_recordedAt_idx" ON "PageUnderstandingEvent"("resourceId", "page", "status", "recordedAt");
CREATE INDEX "PageUnderstandingEvent_userId_resourceId_recordedAt_idx" ON "PageUnderstandingEvent"("userId", "resourceId", "recordedAt");
CREATE UNIQUE INDEX "PageVisit_clientVisitId_key" ON "PageVisit"("clientVisitId");
CREATE INDEX "PageVisit_resourceId_userId_page_enteredAt_idx" ON "PageVisit"("resourceId", "userId", "page", "enteredAt");
CREATE INDEX "PageVisit_userId_resourceId_readerSessionId_leftAt_idx" ON "PageVisit"("userId", "resourceId", "readerSessionId", "leftAt");
CREATE UNIQUE INDEX "CourseDailyActivity_courseId_userId_activityDate_key" ON "CourseDailyActivity"("courseId", "userId", "activityDate");
CREATE INDEX "CourseDailyActivity_courseId_activityDate_idx" ON "CourseDailyActivity"("courseId", "activityDate");
CREATE INDEX "CourseDailyActivity_userId_courseId_activityDate_idx" ON "CourseDailyActivity"("userId", "courseId", "activityDate");

ALTER TABLE "PageUnderstandingState" ADD CONSTRAINT "PageUnderstandingState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageUnderstandingState" ADD CONSTRAINT "PageUnderstandingState_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CourseResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageUnderstandingEvent" ADD CONSTRAINT "PageUnderstandingEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageUnderstandingEvent" ADD CONSTRAINT "PageUnderstandingEvent_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CourseResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageVisit" ADD CONSTRAINT "PageVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PageVisit" ADD CONSTRAINT "PageVisit_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CourseResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseDailyActivity" ADD CONSTRAINT "CourseDailyActivity_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseDailyActivity" ADD CONSTRAINT "CourseDailyActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
