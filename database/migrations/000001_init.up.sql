CREATE SCHEMA trip_app;
SET search_path TO trip_app, public;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trip_app_rw') THEN
        CREATE ROLE trip_app_rw LOGIN PASSWORD 'change_me_rw';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE tripflow TO trip_app_rw;

CREATE TABLE roles (
    id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE
        CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE
        CHECK (email = lower(email) AND position('@' IN email) > 1),
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id SMALLINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE departments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE employees (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    employee_number VARCHAR(30) NOT NULL UNIQUE,
    full_name VARCHAR(200) NOT NULL CHECK (length(trim(full_name)) >= 5),
    position VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    hire_date DATE NOT NULL
);

CREATE TABLE trips (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    destination_country VARCHAR(100) NOT NULL,
    destination_city VARCHAR(120) NOT NULL,
    purpose TEXT NOT NULL CHECK (length(trim(purpose)) BETWEEN 10 AND 1000),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    transport_type VARCHAR(20) NOT NULL
        CHECK (transport_type IN ('AIR', 'RAIL', 'CAR', 'BUS', 'OTHER')),
    accommodation_required BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date)
);

CREATE TABLE travel_requests (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    number VARCHAR(30) NOT NULL UNIQUE,
    employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    trip_id BIGINT NOT NULL UNIQUE REFERENCES trips(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW',
                          'APPROVED', 'REJECTED', 'CANCELED')),
    estimated_total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (estimated_total >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'RUB' CHECK (currency ~ '^[A-Z]{3}$'),
    employee_comment TEXT,
    submitted_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    CHECK ((status = 'DRAFT' AND submitted_at IS NULL)
        OR (status <> 'DRAFT' AND submitted_at IS NOT NULL)),
    CHECK ((status IN ('APPROVED', 'REJECTED') AND decided_at IS NOT NULL)
        OR (status NOT IN ('APPROVED', 'REJECTED') AND decided_at IS NULL))
);

CREATE TABLE expense_categories (
    id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
    name VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE expense_estimates (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id BIGINT NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
    category_id SMALLINT NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
    amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    description VARCHAR(300)
);

CREATE TABLE approval_steps (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id BIGINT NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
    step_order SMALLINT NOT NULL CHECK (step_order > 0),
    approver_employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED')),
    decision_comment TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (request_id, step_order),
    CHECK ((status IN ('APPROVED', 'REJECTED') AND decided_at IS NOT NULL)
        OR (status IN ('PENDING', 'SKIPPED') AND decided_at IS NULL))
);

CREATE TABLE request_status_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id BIGINT NOT NULL REFERENCES travel_requests(id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_by_employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    comment TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (old_status IS NULL OR old_status IN ('DRAFT', 'SUBMITTED',
           'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELED')),
    CHECK (new_status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW',
           'APPROVED', 'REJECTED', 'CANCELED')),
    CHECK (old_status IS DISTINCT FROM new_status)
);

CREATE INDEX idx_travel_requests_employee_status ON travel_requests(employee_id, status);
CREATE INDEX idx_travel_requests_status_created ON travel_requests(status, created_at DESC);
CREATE INDEX idx_trips_dates ON trips(start_date, end_date);
CREATE INDEX idx_approval_steps_approver_status ON approval_steps(approver_employee_id, status);
CREATE INDEX idx_expense_estimates_request ON expense_estimates(request_id);
CREATE INDEX idx_status_history_request_changed ON request_status_history(request_id, changed_at DESC);

REVOKE ALL ON SCHEMA trip_app FROM PUBLIC;
GRANT USAGE ON SCHEMA trip_app TO trip_app_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA trip_app TO trip_app_rw;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA trip_app TO trip_app_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA trip_app
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO trip_app_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA trip_app
    GRANT USAGE, SELECT ON SEQUENCES TO trip_app_rw;
