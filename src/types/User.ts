export interface User {
  name: string;
  email: string;
  id: string;
  role?: "user" | "admin";
  spouseId?: string;
}
