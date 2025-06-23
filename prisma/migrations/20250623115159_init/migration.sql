-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'active', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL,
    "resultUrl" TEXT,
    "progress" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "options" JSONB,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);
