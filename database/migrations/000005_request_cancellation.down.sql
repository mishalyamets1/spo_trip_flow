BEGIN;
DROP INDEX trip_app.idx_approval_steps_processed;
ALTER TABLE trip_app.travel_requests
    DROP CONSTRAINT travel_requests_cancellation_consistency,
    DROP COLUMN canceled_at,
    DROP COLUMN cancellation_reason;
COMMIT;
