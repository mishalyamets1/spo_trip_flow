\set ON_ERROR_STOP on
SET search_path TO trip_app, public;
BEGIN;
DO $$
BEGIN
  BEGIN
    INSERT INTO trips(destination_country,destination_city,purpose,start_date,end_date,transport_type)
    VALUES ('Россия','Казань','Проверка ошибочного диапазона','2026-11-10','2026-11-09','AIR');
    RAISE EXCEPTION 'Q-05: CHECK дат не сработал';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'Q-05: OK (23514)'; END;
  BEGIN
    INSERT INTO travel_requests(number,employee_id,trip_id,status)
    VALUES ('Q06-CHECK',1,1,'DRAFT');
    RAISE EXCEPTION 'Q-06: UNIQUE поездки не сработал';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'Q-06: OK (23505)'; END;
  BEGIN
    INSERT INTO expense_estimates(request_id,category_id,amount) VALUES (1,4,-1);
    RAISE EXCEPTION 'Q-07: CHECK суммы не сработал';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'Q-07: OK (23514)'; END;
  BEGIN
    UPDATE approval_steps SET status='APPROVED',decided_at=NULL WHERE id=1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Q-08: нет исходного этапа'; END IF;
    RAISE EXCEPTION 'Q-08: CHECK решения не сработал';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'Q-08: OK (23514)'; END;
END $$;
ROLLBACK;
