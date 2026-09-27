-- AlterTable
ALTER TABLE "learning_paths" ADD COLUMN     "forkedFromId" TEXT,
ADD COLUMN     "forksCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "learning_paths_forkedFromId_idx" ON "learning_paths"("forkedFromId");

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_forkedFromId_fkey" FOREIGN KEY ("forkedFromId") REFERENCES "learning_paths"("id") ON DELETE SET NULL ON UPDATE CASCADE;
