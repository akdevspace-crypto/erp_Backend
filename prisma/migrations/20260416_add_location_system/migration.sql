CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "pincode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Location_name_idx" ON "Location"("name");
CREATE INDEX "Location_state_idx" ON "Location"("state");
CREATE INDEX "Location_country_idx" ON "Location"("country");
CREATE UNIQUE INDEX "Location_name_state_country_pincode_key" ON "Location"("name", "state", "country", "pincode");

ALTER TABLE "Unit" ADD COLUMN "locationId" TEXT;

INSERT INTO "Location" ("id", "name", "state", "country", "pincode", "createdAt")
SELECT
    gen_random_uuid()::text,
    c."name",
    c."state",
    c."country",
    NULL,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "name", "state", "country"
    FROM "City"
    WHERE "isDeleted" = false
) c;

UPDATE "Unit" u
SET "locationId" = l."id"
FROM "City" c
JOIN "Location" l
    ON l."name" = c."name"
   AND l."state" = c."state"
   AND l."country" = c."country"
WHERE u."cityId" = c."id"
  AND u."locationId" IS NULL;

INSERT INTO "Location" ("id", "name", "state", "country", "pincode", "createdAt")
SELECT
    gen_random_uuid()::text,
    'Unknown',
    'Unknown',
    'Unknown',
    NULL,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1
    FROM "Location"
    WHERE "name" = 'Unknown'
      AND "state" = 'Unknown'
      AND "country" = 'Unknown'
      AND "pincode" IS NULL
);

UPDATE "Unit"
SET "locationId" = (
    SELECT "id"
    FROM "Location"
    WHERE "name" = 'Unknown'
      AND "state" = 'Unknown'
      AND "country" = 'Unknown'
      AND "pincode" IS NULL
    LIMIT 1
)
WHERE "locationId" IS NULL;

ALTER TABLE "Unit" ALTER COLUMN "locationId" SET NOT NULL;

CREATE INDEX "Unit_locationId_idx" ON "Unit"("locationId");

ALTER TABLE "Unit"
ADD CONSTRAINT "Unit_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "Location"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "Unit" DROP COLUMN "cityId";
