export type AdminEmployee = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  employee_number: string;
  position: string;
  department_id: string;
  department_name: string;
  phone: string | null;
  hire_date: string;
  is_active: boolean;
  roles: string[];
  version: number;
};
export type AdminMetadata = {
  departments: { id: string; name: string }[];
  approvers: AdminEmployee[];
};
export type EmployeePreview = {
  employee: AdminEmployee;
  request_count: number;
  pending_count: number;
  route_count: number;
};
export type AdminRoute = {
  id: string;
  name: string;
  department_id: string;
  department_name: string;
  is_active: boolean;
  version: number;
  steps: { employee_id: string; full_name: string; step_order: number }[];
};
export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};
export type AuditEntry = {
  id: string;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  created_at: string;
};
