-- a retry is a new immutable document-operation attempt. Persist the
-- request idempotency key on that attempt so a lost HTTP response cannot
-- turn one confirmed retry into multiple executor dispatches.
ALTER TABLE document_operation_attempts
    ADD COLUMN retry_idempotency_key TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_operation_attempt_retry_key
    ON document_operation_attempts(operation_id, retry_idempotency_key)
    WHERE retry_idempotency_key <> '';
