-- AlterTable
ALTER TABLE "path_nodes" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- Backfill: stable per-path sequence for pre-existing rows (one-shot).
UPDATE "path_nodes" AS n SET "position" = ranked.rn
FROM (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY "pathId" ORDER BY id)) - 1 AS rn
  FROM "path_nodes"
) AS ranked
WHERE n.id = ranked.id;

-- CreateIndex
CREATE INDEX "path_nodes_pathId_position_idx" ON "path_nodes"("pathId", "position");
