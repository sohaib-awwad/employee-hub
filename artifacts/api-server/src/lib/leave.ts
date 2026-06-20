// Annual entitlements (in working days) per leave type. Tuned to realistic,
// non-"exaggerated" figures roughly aligned with regional labour norms:
//   - maternity / paternity are gender-specific and only offered to the
//     matching gender (see allowancesFor).
//   - everything else applies to everyone.
const BASE_ALLOWANCES = {
  annual: 21,
  sick: 14,
  casual: 5,
  unpaid: 14,
  other: 3,
} as const;

const MATERNITY_DAYS = 70; // female only
const PATERNITY_DAYS = 3; // male only

export type LeaveType =
  | "annual"
  | "sick"
  | "casual"
  | "maternity"
  | "paternity"
  | "unpaid"
  | "other";

/**
 * The leave allowances an employee is entitled to, given their gender.
 * Maternity is offered only to female employees, paternity only to male.
 * When gender is unknown (legacy rows), neither parental leave is offered.
 */
export function allowancesFor(gender: string | null | undefined): Record<string, number> {
  const allowances: Record<string, number> = { ...BASE_ALLOWANCES };
  if (gender === "female") allowances.maternity = MATERNITY_DAYS;
  else if (gender === "male") allowances.paternity = PATERNITY_DAYS;
  return allowances;
}

/**
 * Whether a given leave type is allowed for an employee of the given gender.
 * Used to reject e.g. a male employee requesting maternity leave.
 */
export function isLeaveTypeAllowed(type: string, gender: string | null | undefined): boolean {
  if (type === "maternity") return gender === "female";
  if (type === "paternity") return gender === "male";
  return type in BASE_ALLOWANCES;
}
