-- Research-data hardening before formal data collection.
-- Existing submitted rows remain submitted and are backfilled with their historical submit time.
ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'DRAFT';

ALTER TABLE "ReadingSubmission" ALTER COLUMN "submittedAt" DROP NOT NULL;
ALTER TABLE "ReadingSubmission" ALTER COLUMN "submittedAt" DROP DEFAULT;
ALTER TABLE "ReadingSubmission" ADD COLUMN "firstSubmittedAt" TIMESTAMP(3);
ALTER TABLE "ReadingSubmission" ADD COLUMN "lastSubmittedAt" TIMESTAMP(3);
ALTER TABLE "ReadingSubmission" ADD COLUMN "submissionCount" INTEGER NOT NULL DEFAULT 0;
UPDATE "ReadingSubmission"
SET "firstSubmittedAt" = "submittedAt",
    "lastSubmittedAt" = "submittedAt",
    "submissionCount" = CASE WHEN "submittedAt" IS NULL THEN 0 ELSE 1 END;

-- Current annotation state is updated incrementally, so each client annotation id must be unique per submission.
CREATE UNIQUE INDEX "Note_submissionId_clientId_key" ON "Note"("submissionId", "clientId");
CREATE UNIQUE INDEX "Highlight_submissionId_clientId_key" ON "Highlight"("submissionId", "clientId");

-- One durable row per resource/student/Taipei calendar day with actual reader activity.
CREATE TABLE "ResourceDailyActivity" (
  "id" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "activityDate" DATE NOT NULL,
  "firstActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResourceDailyActivity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ResourceDailyActivity_resourceId_userId_activityDate_key" ON "ResourceDailyActivity"("resourceId", "userId", "activityDate");
CREATE INDEX "ResourceDailyActivity_resourceId_activityDate_idx" ON "ResourceDailyActivity"("resourceId", "activityDate");
CREATE INDEX "ResourceDailyActivity_userId_resourceId_activityDate_idx" ON "ResourceDailyActivity"("userId", "resourceId", "activityDate");
ALTER TABLE "ResourceDailyActivity" ADD CONSTRAINT "ResourceDailyActivity_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CourseResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceDailyActivity" ADD CONSTRAINT "ResourceDailyActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill local/test reading days from existing page visits. The DATE is based on the
-- platform research timezone rather than the database server timezone.
INSERT INTO "ResourceDailyActivity" ("id", "resourceId", "userId", "activityDate", "firstActivityAt", "lastActivityAt")
SELECT
  md5("resourceId" || ':' || "userId" || ':' || ((("enteredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Taipei')::date)::text),
  "resourceId",
  "userId",
  (("enteredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Taipei')::date,
  MIN("enteredAt"),
  MAX("lastSeenAt")
FROM "PageVisit"
GROUP BY "resourceId", "userId", (("enteredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Taipei')::date
ON CONFLICT ("resourceId", "userId", "activityDate") DO NOTHING;

CREATE TYPE "AnnotationEntityType" AS ENUM ('NOTE', 'HIGHLIGHT');
CREATE TYPE "AnnotationAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');
CREATE TYPE "AnnotationSource" AS ENUM ('AUTO_SYNC', 'SUBMIT_SYNC');

-- Immutable event history. Current Note/Highlight rows remain the materialized current state.
CREATE TABLE "AnnotationEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "entityType" "AnnotationEntityType" NOT NULL,
  "action" "AnnotationAction" NOT NULL,
  "source" "AnnotationSource" NOT NULL,
  "page" INTEGER NOT NULL,
  "noteType" "NoteType",
  "highlightType" "HighlightType",
  "color" TEXT,
  "content" TEXT,
  "extractedText" TEXT,
  "geometry" JSONB,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnnotationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AnnotationEvent_resourceId_userId_recordedAt_idx" ON "AnnotationEvent"("resourceId", "userId", "recordedAt");
CREATE INDEX "AnnotationEvent_resourceId_page_entityType_recordedAt_idx" ON "AnnotationEvent"("resourceId", "page", "entityType", "recordedAt");
ALTER TABLE "AnnotationEvent" ADD CONSTRAINT "AnnotationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnotationEvent" ADD CONSTRAINT "AnnotationEvent_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "CourseResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
