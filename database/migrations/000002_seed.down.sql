SET search_path TO trip_app, public;

TRUNCATE request_status_history, approval_steps, expense_estimates,
         travel_requests, trips, user_roles, employees, users,
         expense_categories, departments, roles
RESTART IDENTITY CASCADE;
