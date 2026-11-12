BEGIN;
ALTER TABLE trip_app.departments DROP COLUMN is_active, DROP COLUMN version;
ALTER TABLE trip_app.expense_categories DROP COLUMN is_active, DROP COLUMN version;
COMMIT;
