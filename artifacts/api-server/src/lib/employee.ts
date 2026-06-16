import type { Employee } from "@workspace/db";

// The employee shape that is safe to send to clients — everything except the
// password hash. The API must never leak passwordHash.
export type PublicEmployee = Omit<Employee, "passwordHash">;

export function toPublicEmployee(employee: Employee): PublicEmployee {
  const { passwordHash: _passwordHash, ...rest } = employee;
  return rest;
}
