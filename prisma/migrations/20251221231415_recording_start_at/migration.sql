-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "recordingDuration" INTEGER,
ADD COLUMN     "recordingEndAt" TIMESTAMP(3),
ADD COLUMN     "recordingStartAt" TIMESTAMP(3);
