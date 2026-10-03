/*
  Warnings:

  - The values [STOPPED,TRIAL] on the enum `StudentStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StudentStatus_new" AS ENUM ('ACTIVE', 'PAUSED', 'INACTIVE');
ALTER TABLE "public"."Student" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Student" ALTER COLUMN "status" TYPE "StudentStatus_new" USING ("status"::text::"StudentStatus_new");
ALTER TYPE "StudentStatus" RENAME TO "StudentStatus_old";
ALTER TYPE "StudentStatus_new" RENAME TO "StudentStatus";
DROP TYPE "public"."StudentStatus_old";
ALTER TABLE "Student" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
COMMIT;
