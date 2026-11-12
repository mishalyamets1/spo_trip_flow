-- Match the owner filter and stable ordering without sorting all owner's rows.
CREATE INDEX idx_travel_requests_employee_created
 ON trip_app.travel_requests(employee_id,created_at DESC,id DESC);
