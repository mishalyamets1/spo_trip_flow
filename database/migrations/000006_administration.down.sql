BEGIN;
-- A deleted historical actor cannot be reconstructed. Refuse a lossy rollback.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM trip_app.approval_steps WHERE approver_employee_id IS NULL)
 OR EXISTS (SELECT 1 FROM trip_app.request_status_history WHERE changed_by_employee_id IS NULL)
 THEN RAISE EXCEPTION 'Deleted historical actors exist; restore a compatible backup instead'; END IF;
END $$;
DROP TABLE trip_app.admin_audit_log;
DROP TRIGGER capture_approver_name ON trip_app.approval_steps;
DROP TRIGGER capture_history_actor ON trip_app.request_status_history;
DROP FUNCTION trip_app.capture_actor_name();
ALTER TABLE trip_app.approval_steps DROP CONSTRAINT pending_approver_required;
ALTER TABLE trip_app.approval_steps DROP CONSTRAINT approval_steps_approver_employee_id_fkey;
ALTER TABLE trip_app.approval_steps ADD FOREIGN KEY (approver_employee_id) REFERENCES trip_app.employees(id) ON DELETE RESTRICT;
ALTER TABLE trip_app.approval_steps ALTER COLUMN approver_employee_id SET NOT NULL;
ALTER TABLE trip_app.approval_steps DROP COLUMN approver_name_snapshot;
ALTER TABLE trip_app.request_status_history DROP CONSTRAINT request_status_history_changed_by_employee_id_fkey;
ALTER TABLE trip_app.request_status_history ADD FOREIGN KEY (changed_by_employee_id) REFERENCES trip_app.employees(id) ON DELETE RESTRICT;
ALTER TABLE trip_app.request_status_history ALTER COLUMN changed_by_employee_id SET NOT NULL;
ALTER TABLE trip_app.request_status_history DROP COLUMN changed_by_name_snapshot;
ALTER TABLE trip_app.approval_routes DROP COLUMN version;
ALTER TABLE trip_app.employees DROP COLUMN version;
COMMIT;
