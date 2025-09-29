-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('pending', 'posted', 'canceled', 'reversed');

-- CreateEnum
CREATE TYPE "TxSign" AS ENUM ('debit', 'credit');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('aggregator', 'direct');

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProviderType" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "account_type" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "mask" TEXT,
    "display_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_transactions" (
    "id" TEXT NOT NULL,
    "provider_tx_id" TEXT,
    "provider_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "timestamp_posted" TIMESTAMP(3),
    "timestamp_auth" TIMESTAMP(3),
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description_raw" TEXT NOT NULL,
    "counterparty_raw" TEXT,
    "balance_after" DECIMAL(18,2),
    "meta_json" JSONB NOT NULL DEFAULT '{}',
    "hash_v1" TEXT NOT NULL,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canonical_transactions" (
    "id" TEXT NOT NULL,
    "group_key" TEXT,
    "account_id" TEXT NOT NULL,
    "posted_at" TIMESTAMP(3) NOT NULL,
    "effective_at" TIMESTAMP(3),
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description_norm" TEXT NOT NULL,
    "counterparty_norm" TEXT,
    "fit_id" TEXT,
    "tx_type" TEXT NOT NULL,
    "status" "TxStatus" NOT NULL DEFAULT 'posted',
    "source_quality" TEXT NOT NULL DEFAULT 'B',
    "raw_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canonical_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "links_transfers" (
    "id" TEXT NOT NULL,
    "txn_out_id" TEXT NOT NULL,
    "txn_in_id" TEXT NOT NULL,
    "detection_method" TEXT NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "window_sec" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "links_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "is_transfer" BOOLEAN NOT NULL DEFAULT false,
    "is_payment" BOOLEAN NOT NULL DEFAULT false,
    "is_refund" BOOLEAN NOT NULL DEFAULT false,
    "gaap_map" TEXT,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "txn_classifications" (
    "txn_id" TEXT NOT NULL,
    "category_id" TEXT,
    "confidence" DECIMAL(3,2) NOT NULL,
    "model_version" TEXT,
    "explanations" JSONB NOT NULL DEFAULT '{}',
    "locked_by_user" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "txn_classifications_pkey" PRIMARY KEY ("txn_id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "txn_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "gl_account" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "sign" "TxSign" NOT NULL,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_runs" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "as_of_date" DATE NOT NULL,
    "system_balance" DECIMAL(18,2) NOT NULL,
    "institution_balance" DECIMAL(18,2) NOT NULL,
    "delta" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL,
    "report_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "raw_transactions_account_id_ingested_at_idx" ON "raw_transactions"("account_id", "ingested_at");

-- CreateIndex
CREATE UNIQUE INDEX "raw_provider_txid" ON "raw_transactions"("provider_id", "provider_tx_id");

-- CreateIndex
CREATE UNIQUE INDEX "raw_provider_acct_hash" ON "raw_transactions"("provider_id", "account_id", "hash_v1");

-- CreateIndex
CREATE INDEX "canonical_transactions_account_id_posted_at_idx" ON "canonical_transactions"("account_id", "posted_at");

-- CreateIndex
CREATE INDEX "canonical_transactions_amount_posted_at_idx" ON "canonical_transactions"("amount", "posted_at");

-- CreateIndex
CREATE INDEX "canonical_transactions_group_key_idx" ON "canonical_transactions"("group_key");

-- CreateIndex
CREATE INDEX "links_transfers_txn_out_id_idx" ON "links_transfers"("txn_out_id");

-- CreateIndex
CREATE INDEX "links_transfers_txn_in_id_idx" ON "links_transfers"("txn_in_id");

-- CreateIndex
CREATE UNIQUE INDEX "links_transfers_txn_out_id_txn_in_id_key" ON "links_transfers"("txn_out_id", "txn_in_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "ledger_entries_gl_account_idx" ON "ledger_entries"("gl_account");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_txn_id_line_no_key" ON "ledger_entries"("txn_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "account_id_as_of_date" ON "reconciliation_runs"("account_id", "as_of_date");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_transactions" ADD CONSTRAINT "raw_transactions_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_transactions" ADD CONSTRAINT "raw_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canonical_transactions" ADD CONSTRAINT "canonical_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links_transfers" ADD CONSTRAINT "links_transfers_txn_out_id_fkey" FOREIGN KEY ("txn_out_id") REFERENCES "canonical_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links_transfers" ADD CONSTRAINT "links_transfers_txn_in_id_fkey" FOREIGN KEY ("txn_in_id") REFERENCES "canonical_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "txn_classifications" ADD CONSTRAINT "txn_classifications_txn_id_fkey" FOREIGN KEY ("txn_id") REFERENCES "canonical_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "txn_classifications" ADD CONSTRAINT "txn_classifications_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_txn_id_fkey" FOREIGN KEY ("txn_id") REFERENCES "canonical_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
