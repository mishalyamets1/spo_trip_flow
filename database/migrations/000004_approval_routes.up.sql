CREATE TABLE trip_app.approval_routes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id BIGINT NOT NULL REFERENCES trip_app.departments(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE UNIQUE INDEX idx_approval_routes_active_department
    ON trip_app.approval_routes(department_id) WHERE is_active;
CREATE TABLE trip_app.approval_route_steps (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    route_id BIGINT NOT NULL REFERENCES trip_app.approval_routes(id) ON DELETE CASCADE,
    step_order SMALLINT NOT NULL CHECK (step_order > 0),
    approver_employee_id BIGINT NOT NULL REFERENCES trip_app.employees(id) ON DELETE RESTRICT,
    UNIQUE (route_id, step_order),
    UNIQUE (route_id, approver_employee_id)
);
ALTER TABLE trip_app.travel_requests ADD COLUMN approval_route_id BIGINT
    REFERENCES trip_app.approval_routes(id) ON DELETE RESTRICT;
GRANT SELECT, INSERT, UPDATE, DELETE ON trip_app.approval_routes, trip_app.approval_route_steps TO trip_app_rw;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA trip_app TO trip_app_rw;
