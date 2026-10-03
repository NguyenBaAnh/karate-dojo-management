-- CreateEnum
CREATE TYPE "BankTransferEventStatus" AS ENUM ('RECEIVED', 'MATCHED', 'UNMATCHED', 'NEEDS_REVIEW', 'IGNORED');

-- CreateTable
CREATE TABLE "BankTransferEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "accountNo" TEXT,
    "transferredAt" TIMESTAMP(3) NOT NULL,
    "status" "BankTransferEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "note" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankTransferEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankTransferEvent_status_transferredAt_idx" ON "BankTransferEvent"("status", "transferredAt");

-- CreateIndex
CREATE INDEX "BankTransferEvent_invoiceId_idx" ON "BankTransferEvent"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransferEvent_provider_transactionId_key" ON "BankTransferEvent"("provider", "transactionId");
