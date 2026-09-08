import type { Role } from "@/generated/prisma/enums";

export function homeForRole(role: Role) {
  if (role === "ADMIN") return "/admin";
  if (role === "TA") return "/ta";
  return "/courses";
}
