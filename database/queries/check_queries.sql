-- Контрольные запросы Q-01 … Q-04 из отчёта (раздел 4.6)

\set ON_ERROR_STOP on
SET search_path TO trip_app, public;

\echo '=== Q-01: Карточка заявки ==='
SELECT r.number, e.full_name, t.destination_city, t.start_date, t.end_date,
       r.status, r.estimated_total
FROM travel_requests r
JOIN employees e ON e.id = r.employee_id
JOIN trips t ON t.id = r.trip_id
WHERE r.number = 'TR-2026-0001';

\echo '=== Q-02: Проверка суммы сметы ==='
SELECT r.number, r.estimated_total, SUM(x.amount) AS calculated_total
FROM travel_requests r
JOIN expense_estimates x ON x.request_id = r.id
GROUP BY r.id, r.number, r.estimated_total;

\echo '=== Q-03: Очередь согласующего ==='
SELECT r.number, a.step_order, a.status
FROM approval_steps a
JOIN travel_requests r ON r.id = a.request_id
WHERE a.approver_employee_id = 2 AND a.status = 'PENDING';

\echo '=== Q-04: История статусов ==='
SELECT old_status, new_status, comment
FROM request_status_history
WHERE request_id = 1
ORDER BY changed_at, id;
