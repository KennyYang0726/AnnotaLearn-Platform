-- Add a per-course material download policy. Existing courses stay closed by default.
ALTER TABLE "Course" ADD COLUMN "allowMaterialDownload" BOOLEAN NOT NULL DEFAULT false;

-- Preserve the date on which the student originally created each note/highlight.
-- Existing rows are backfilled from their prior database creation timestamps.
ALTER TABLE "Note" ADD COLUMN "recordedAt" TIMESTAMP(3);
UPDATE "Note" SET "recordedAt" = "createdAt" WHERE "recordedAt" IS NULL;
ALTER TABLE "Note" ALTER COLUMN "recordedAt" SET NOT NULL;
ALTER TABLE "Note" ALTER COLUMN "recordedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Highlight" ADD COLUMN "recordedAt" TIMESTAMP(3);
UPDATE "Highlight" SET "recordedAt" = "createdAt" WHERE "recordedAt" IS NULL;
ALTER TABLE "Highlight" ALTER COLUMN "recordedAt" SET NOT NULL;
ALTER TABLE "Highlight" ALTER COLUMN "recordedAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Note_submissionId_recordedAt_idx" ON "Note"("submissionId", "recordedAt");
CREATE INDEX "Highlight_submissionId_recordedAt_idx" ON "Highlight"("submissionId", "recordedAt");
