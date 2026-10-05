ALTER TABLE "Shelf" ADD COLUMN "shelfId" TEXT NOT NULL DEFAULT '';

UPDATE "Shelf" SET "shelfId" = 'shelf-A' WHERE "name" = 'Shelf A';
UPDATE "Shelf" SET "shelfId" = 'shelf-B' WHERE "name" = 'Shelf B';
UPDATE "Shelf" SET "shelfId" = 'shelf-C' WHERE "name" = 'Shelf C';
UPDATE "Shelf" SET "shelfId" = 'shelf-' || substr("id", 1, 8) WHERE "shelfId" = '';

CREATE UNIQUE INDEX "Shelf_shelfId_key" ON "Shelf"("shelfId");