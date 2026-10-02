-- CreateTable
CREATE TABLE "whatsapp_outbound_messages" (
    "id" TEXT NOT NULL,
    "inbound_message_id" TEXT NOT NULL,
    "wa_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sending_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_outbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_outbound_messages_inbound_message_id_key"
    ON "whatsapp_outbound_messages"("inbound_message_id");

-- CreateIndex
CREATE INDEX "whatsapp_outbound_messages_status_next_attempt_at_idx"
    ON "whatsapp_outbound_messages"("status", "next_attempt_at");
