-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "snapshotId" TEXT,
ADD COLUMN     "thumbnails" JSONB,
ADD COLUMN     "videoUrls" JSONB;

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "options" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateSnapshot" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Template_name_key" ON "Template"("name");

-- CreateIndex
CREATE INDEX "TemplateSnapshot_templateId_idx" ON "TemplateSnapshot"("templateId");

-- CreateIndex
CREATE INDEX "Job_snapshotId_idx" ON "Job"("snapshotId");

-- AddForeignKey
ALTER TABLE "TemplateSnapshot" ADD CONSTRAINT "TemplateSnapshot_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TemplateSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
