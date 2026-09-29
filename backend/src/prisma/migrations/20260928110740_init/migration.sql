-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "external_user_id" TEXT NOT NULL,
    "current_question_id" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "preferred_comm" TEXT NOT NULL,
    "phone_call_time" TEXT,
    "flow_type" TEXT NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_is_completed_idx" ON "conversations"("is_completed");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_channel_external_user_id_key" ON "conversations"("channel", "external_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_conversation_id_key" ON "leads"("conversation_id");

-- CreateIndex
CREATE INDEX "leads_flow_type_idx" ON "leads"("flow_type");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
