SET search_path TO trip_app, public;

INSERT INTO roles (code, name) VALUES
    ('EMPLOYEE', 'Сотрудник'),
    ('APPROVER', 'Согласующий'),
    ('ADMIN', 'Администратор');

INSERT INTO departments (name) VALUES
    ('Отдел разработки'),
    ('Финансовый отдел');

INSERT INTO users (email, password_hash) VALUES
    ('maxim@example.test', 'TEST_HASH_NOT_FOR_AUTH'),
    ('manager@example.test', 'TEST_HASH_NOT_FOR_AUTH');

INSERT INTO employees
    (user_id, department_id, employee_number, full_name, position, phone, hire_date)
VALUES
    (1, 1, 'EMP-001', 'Максим Геннадьевич Шлапаков', 'Аналитик', '+70000000001', DATE '2025-09-01'),
    (2, 1, 'EMP-002', 'Владимир Алексеевич Беломытцев', 'Руководитель проекта', '+70000000002', DATE '2025-09-01');

INSERT INTO user_roles (user_id, role_id) VALUES
    (1, 1),
    (2, 1),
    (2, 2);

INSERT INTO expense_categories (code, name) VALUES
    ('TRANSPORT', 'Транспорт'),
    ('ACCOMMODATION', 'Проживание'),
    ('DAILY_ALLOWANCE', 'Суточные'),
    ('OTHER', 'Прочие расходы');

INSERT INTO trips
    (destination_country, destination_city, purpose, start_date, end_date,
     transport_type, accommodation_required)
VALUES
    ('Россия', 'Санкт-Петербург',
     'Участие в рабочей встрече по внедрению информационной системы',
     DATE '2026-10-12', DATE '2026-10-15', 'RAIL', TRUE);

INSERT INTO travel_requests
    (number, employee_id, trip_id, status, estimated_total, currency,
     employee_comment, submitted_at)
VALUES
    ('TR-2026-0001', 1, 1, 'SUBMITTED', 42500.00, 'RUB',
     'Прошу согласовать поездку по плану проекта.', CURRENT_TIMESTAMP);

INSERT INTO expense_estimates (request_id, category_id, amount, description) VALUES
    (1, 1, 12000.00, 'Железнодорожные билеты туда и обратно'),
    (1, 2, 24000.00, 'Три ночи в гостинице'),
    (1, 3, 6500.00, 'Суточные за четыре календарных дня');

INSERT INTO approval_steps
    (request_id, step_order, approver_employee_id, status)
VALUES
    (1, 1, 2, 'PENDING');

INSERT INTO request_status_history
    (request_id, old_status, new_status, changed_by_employee_id, comment)
VALUES
    (1, NULL, 'DRAFT', 1, 'Заявка создана'),
    (1, 'DRAFT', 'SUBMITTED', 1, 'Заявка отправлена на согласование');
