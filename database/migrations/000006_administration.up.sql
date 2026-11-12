BEGIN;
ALTER TABLE trip_app.employees ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);
ALTER TABLE trip_app.approval_routes ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0);

ALTER TABLE trip_app.approval_steps ADD COLUMN approver_name_snapshot TEXT;
UPDATE trip_app.approval_steps a SET approver_name_snapshot=e.full_name FROM trip_app.employees e WHERE e.id=a.approver_employee_id;
ALTER TABLE trip_app.approval_steps ALTER COLUMN approver_name_snapshot SET NOT NULL;
ALTER TABLE trip_app.approval_steps ALTER COLUMN approver_employee_id DROP NOT NULL;
ALTER TABLE trip_app.approval_steps DROP CONSTRAINT approval_steps_approver_employee_id_fkey;
ALTER TABLE trip_app.approval_steps ADD FOREIGN KEY (approver_employee_id) REFERENCES trip_app.employees(id) ON DELETE SET NULL;
ALTER TABLE trip_app.approval_steps ADD CONSTRAINT pending_approver_required CHECK (status <> 'PENDING' OR approver_employee_id IS NOT NULL);

ALTER TABLE trip_app.request_status_history ADD COLUMN changed_by_name_snapshot TEXT;
UPDATE trip_app.request_status_history h SET changed_by_name_snapshot=e.full_name FROM trip_app.employees e WHERE e.id=h.changed_by_employee_id;
ALTER TABLE trip_app.request_status_history ALTER COLUMN changed_by_name_snapshot SET NOT NULL;
ALTER TABLE trip_app.request_status_history ALTER COLUMN changed_by_employee_id DROP NOT NULL;
ALTER TABLE trip_app.request_status_history DROP CONSTRAINT request_status_history_changed_by_employee_id_fkey;
ALTER TABLE trip_app.request_status_history ADD FOREIGN KEY (changed_by_employee_id) REFERENCES trip_app.employees(id) ON DELETE SET NULL;

-- Older writers can still insert rows without knowing the new snapshot columns.
CREATE FUNCTION trip_app.capture_actor_name() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME = 'approval_steps' THEN
   IF NEW.approver_name_snapshot IS NULL THEN
     SELECT full_name INTO NEW.approver_name_snapshot FROM trip_app.employees WHERE id=NEW.approver_employee_id;
   END IF;
 ELSE
   IF NEW.changed_by_name_snapshot IS NULL THEN
     SELECT full_name INTO NEW.changed_by_name_snapshot FROM trip_app.employees WHERE id=NEW.changed_by_employee_id;
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER capture_approver_name BEFORE INSERT ON trip_app.approval_steps FOR EACH ROW EXECUTE FUNCTION trip_app.capture_actor_name();
CREATE TRIGGER capture_history_actor BEFORE INSERT ON trip_app.request_status_history FOR EACH ROW EXECUTE FUNCTION trip_app.capture_actor_name();

CREATE TABLE trip_app.admin_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id BIGINT REFERENCES trip_app.users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_audit_created ON trip_app.admin_audit_log(created_at DESC,id DESC);
COMMIT;
