/*
  Warnings:

  - A unique constraint covering the columns `[studentPackageId]` on the table `TuitionInvoice` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PackageBillingType" AS ENUM ('TIME_BASED', 'SESSION_BASED', 'PT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PackageDurationUnit" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "StudentPackageStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "TuitionInvoice" ADD COLUMN     "studentPackageId" TEXT;

-- CreateTable
CREATE TABLE "LearningPackage" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billingType" "PackageBillingType" NOT NULL DEFAULT 'TIME_BASED',
    "durationValue" INTEGER,
    "durationUnit" "PackageDurationUnit",
    "sessionsPerWeek" INTEGER,
    "includedSessions" INTEGER,
    "price" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPackage" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "paymentDueDate" TIMESTAMP(3),
    "status" "StudentPackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "packageCodeSnapshot" TEXT NOT NULL,
    "packageNameSnapshot" TEXT NOT NULL,
    "billingTypeSnapshot" "PackageBillingType" NOT NULL,
    "durationValueSnapshot" INTEGER,
    "durationUnitSnapshot" "PackageDurationUnit",
    "sessionsPerWeekSnapshot" INTEGER,
    "includedSessionsSnapshot" INTEGER,
    "priceSnapshot" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "pauseStartedAt" TIMESTAMP(3),
    "totalPausedDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPackage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearningPackage_code_key" ON "LearningPackage"("code");

-- CreateIndex
CREATE INDEX "LearningPackage_active_name_idx" ON "LearningPackage"("active", "name");

-- CreateIndex
CREATE INDEX "StudentPackage_studentId_status_endDate_idx" ON "StudentPackage"("studentId", "status", "endDate");

-- CreateIndex
CREATE INDEX "StudentPackage_packageId_status_idx" ON "StudentPackage"("packageId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TuitionInvoice_studentPackageId_key" ON "TuitionInvoice"("studentPackageId");

-- CreateIndex
CREATE INDEX "TuitionInvoice_studentPackageId_idx" ON "TuitionInvoice"("studentPackageId");

-- AddForeignKey
ALTER TABLE "TuitionInvoice" ADD CONSTRAINT "TuitionInvoice_studentPackageId_fkey" FOREIGN KEY ("studentPackageId") REFERENCES "StudentPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPackage" ADD CONSTRAINT "StudentPackage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPackage" ADD CONSTRAINT "StudentPackage_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "LearningPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
