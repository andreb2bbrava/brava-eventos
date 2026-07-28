export const ROLES = ["platform_owner", "super_admin", "produtor", "staff"] as const;

export type RoleUsuario = (typeof ROLES)[number];

export function isRoleUsuario(role: string | null | undefined): role is RoleUsuario {
  return role === "platform_owner" || role === "super_admin" || role === "produtor" || role === "staff";
}

export function isPlatformOwner(role: string | null | undefined) {
  return role === "platform_owner";
}

export function isAdminRole(role: string | null | undefined) {
  return role === "platform_owner" || role === "super_admin";
}

export function canEditEventRole(role: string | null | undefined) {
  return isAdminRole(role) || role === "produtor";
}

export function canCheckinRole(role: string | null | undefined) {
  return canEditEventRole(role) || role === "staff";
}

export function roleLabel(role: string | null | undefined) {
  if (role === "platform_owner") {
    return "Proprietario da Plataforma";
  }

  if (role === "super_admin") {
    return "Administrador Geral";
  }

  if (role === "produtor") {
    return "Produtor";
  }

  if (role === "staff") {
    return "Staff";
  }

  return "Operacao";
}
