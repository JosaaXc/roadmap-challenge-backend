-- AlterTable
ALTER TABLE "learning_paths" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "learning_paths_isPublic_idx" ON "learning_paths"("isPublic");
