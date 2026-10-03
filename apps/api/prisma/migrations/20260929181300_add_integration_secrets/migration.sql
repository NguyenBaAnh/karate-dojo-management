-- =========================================================
-- 1. Convert SystemSetting.value safely to JSONB
--    - valid JSON   -> preserve as JSON
--    - plain text   -> JSON string
--    - SQL NULL     -> JSON null
-- =========================================================

CREATE OR REPLACE FUNCTION "__karate_text_to_jsonb"(input_value TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    IF input_value IS NULL THEN
        RETURN 'null'::jsonb;
    END IF;

    BEGIN
        RETURN input_value::jsonb;
    EXCEPTION WHEN OTHERS THEN
        RETURN to_jsonb(input_value);
    END;
END;
$$;

ALTER TABLE "SystemSetting"
ALTER COLUMN "value" DROP NOT NULL;

ALTER TABLE "SystemSetting"
ALTER COLUMN "value" TYPE JSONB
USING "__karate_text_to_jsonb"("value"::text);

UPDATE "SystemSetting"
SET "value" = 'null'::jsonb
WHERE "value" IS NULL;

ALTER TABLE "SystemSetting"
ALTER COLUMN "value" SET NOT NULL;

DROP FUNCTION "__karate_text_to_jsonb"(TEXT);


-- =========================================================
-- 2. Integration secrets
-- =========================================================

CREATE TABLE IF NOT EXISTS "IntegrationSecret" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueEnc" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSecret_pkey"
        PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationSecret_provider_key_key"
ON "IntegrationSecret"("provider", "key");

CREATE INDEX IF NOT EXISTS "IntegrationSecret_provider_idx"
ON "IntegrationSecret"("provider");