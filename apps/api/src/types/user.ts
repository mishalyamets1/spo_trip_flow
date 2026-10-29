export interface User {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  roles: string[];
}
declare global {
  namespace Express {
    interface Request {
      user: User;
      sessionHash: string;
    }
  }
}
