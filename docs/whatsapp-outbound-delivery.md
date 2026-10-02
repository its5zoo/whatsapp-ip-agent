# WhatsApp outbound delivery

Inbound WhatsApp processing and `ProcessedWhatsappMessage` deduplication commit
with a durable PostgreSQL outbound record. A small in-process dispatcher claims
pending or retryable records, sends outside the database transaction, and
records `sent`, terminal `failed`, or retryable outcomes.

Known successful sends are not repeated. A timeout or lost HTTP response is
treated as retryable because the provider may have accepted the message before
the response was lost. That creates an unavoidable at-least-once delivery risk:
one retry can produce a duplicate WhatsApp message. Provider-side idempotency
would be required to eliminate that ambiguity completely.
