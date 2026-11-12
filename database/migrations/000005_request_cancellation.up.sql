BEGIN;

ALTER TABLE trip_app.travel_requests
    ADD COLUMN canceled_at TIMESTAMPTZ,
    ADD COLUMN cancellation_reason TEXT;

-- Preserve legacy cancellations. Prefer recorded history; where it is missing,
-- updated_at is a compatibility timestamp and the reason explicitly stays unknown.
UPDATE trip_app.travel_requests r
SET canceled_at = COALESCE(
        (SELECT max(h.changed_at) FROM trip_app.request_status_history h
         WHERE h.request_id = r.id AND h.new_status = 'CANCELED'),
        r.updated_at),
    cancellation_reason = COALESCE(
        (SELECT left(nullif(btrim(h.comment), ''), 2000)
         FROM trip_app.request_status_history h
         WHERE h.request_id = r.id AND h.new_status = 'CANCELED'
           AND nullif(btrim(h.comment), '') IS NOT NULL
         ORDER BY h.changed_at DESC, h.id DESC LIMIT 1),
        'Причина отмены не сохранялась в предыдущей версии')
WHERE r.status = 'CANCELED';

ALTER TABLE trip_app.travel_requests
    ADD CONSTRAINT travel_requests_cancellation_consistency CHECK (
        (status = 'CANCELED' AND canceled_at IS NOT NULL
         AND cancellation_reason IS NOT NULL
         AND length(btrim(cancellation_reason)) BETWEEN 1 AND 2000)
        OR
        (status <> 'CANCELED' AND canceled_at IS NULL AND cancellation_reason IS NULL)
    );

CREATE INDEX idx_approval_steps_processed
    ON trip_app.approval_steps(approver_employee_id, decided_at DESC, id DESC)
    WHERE status IN ('APPROVED', 'REJECTED');

COMMIT;
