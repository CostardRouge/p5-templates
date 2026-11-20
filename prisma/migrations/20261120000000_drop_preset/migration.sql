-- The Preset model (tables "Template" / "TemplateSnapshot") was never read nor
-- written by the application: the gallery (IndexedDB) and the exported options
-- replaced it. Dropped with the link from Job (docs/memory/deployment.md).

-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT IF EXISTS "Job_snapshotId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Job_snapshotId_idx";

-- AlterTable
ALTER TABLE "Job" DROP COLUMN IF EXISTS "snapshotId";

-- DropTable
DROP TABLE IF EXISTS "TemplateSnapshot";

-- DropTable
DROP TABLE IF EXISTS "Template";
