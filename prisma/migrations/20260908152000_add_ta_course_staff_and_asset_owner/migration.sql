-- Add a dedicated teaching-assistant role.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TA';

-- Track who uploaded an asset. Existing assets remain NULL and are treated as legacy/system assets.
ALTER TABLE "Asset" ADD COLUMN "createdById" TEXT;
CREATE INDEX "Asset_createdById_idx" ON "Asset"("createdById");
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Course-scoped staff assignments. A TA only gains access to explicitly assigned courses.
CREATE TABLE "CourseStaff" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseStaff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CourseStaff_userId_courseId_key" ON "CourseStaff"("userId", "courseId");
CREATE INDEX "CourseStaff_courseId_idx" ON "CourseStaff"("courseId");
ALTER TABLE "CourseStaff" ADD CONSTRAINT "CourseStaff_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseStaff" ADD CONSTRAINT "CourseStaff_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
