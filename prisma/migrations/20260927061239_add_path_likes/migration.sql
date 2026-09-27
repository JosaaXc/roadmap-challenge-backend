-- AlterTable
ALTER TABLE "learning_paths" ADD COLUMN     "likesCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "path_likes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "path_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "path_likes_pathId_idx" ON "path_likes"("pathId");

-- CreateIndex
CREATE UNIQUE INDEX "path_likes_userId_pathId_key" ON "path_likes"("userId", "pathId");

-- AddForeignKey
ALTER TABLE "path_likes" ADD CONSTRAINT "path_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "path_likes" ADD CONSTRAINT "path_likes_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;
