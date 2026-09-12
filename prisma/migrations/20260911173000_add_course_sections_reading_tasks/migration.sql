-- CreateTable
CREATE TABLE "CourseSection" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CourseSection_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CourseResource"
ADD COLUMN "sectionId" TEXT,
ADD COLUMN "readingTaskEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "availableFrom" TIMESTAMP(3),
ADD COLUMN "dueAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CourseSection_courseId_sortOrder_idx" ON "CourseSection"("courseId", "sortOrder");
CREATE INDEX "CourseResource_sectionId_sortOrder_idx" ON "CourseResource"("sectionId", "sortOrder");

-- AddForeignKey
ALTER TABLE "CourseSection" ADD CONSTRAINT "CourseSection_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseResource" ADD CONSTRAINT "CourseResource_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CourseSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
