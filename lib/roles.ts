export const ROLES = ["platform_owner", "super_admin", "produtor", "staff"] as const;

export type RoleUsuario = (typeof ROLES)[number];

function normalizarRole(role: string | null | undefined) {
  return String(role || "").trim().toLowerCase();
}

export function resolverRoleUsuario(role: string | null | undefined): RoleUsuario | null {
  const roleNormalizado = normalizarRole(role);

  if (roleNormalizado === "platform_owner") {
    return "platform_owner";
  }

  if (roleNormalizado === "super_admin") {
    return "super_admin";
  }

  if (roleNormalizado === "produtor") {
    return "produtor";
  }

  if (roleNormalizado === "staff") {
    return "staff";
  }

  return null;
}

export function isRoleUsuario(role: string | null | undefined): role is RoleUsuario {
  return resolverRoleUsuario(role) !== null;
}

export function isPlatformOwner(role: string | null | undefined) {
  return resolverRoleUsuario(role) === "platform_owner";
}

export function isAdminRole(role: string | null | undefined) {
  const roleResolvido = resolverRoleUsuario(role);

  return (
    roleResolvido === "platform_owner" ||
    roleResolvido === "super_admin"
  );
}

export function canCreateEventRole(role: string | null | undefined) {
  return (
    isAdminRole(role) ||
    resolverRoleUsuario(role) === "produtor"
  );
}

export function canEditEventRole(role: string | null | undefined) {
  return canCreateEventRole(role);
}

export function canDeleteEventRole(role: string | null | undefined) {
  return isAdminRole(role);
}

export function canCreateListRole(role: string | null | undefined) {
  const roleResolvido = resolverRoleUsuario(role);

  return (
    isAdminRole(role) ||
    roleResolvido === "produtor" ||
    roleResolvido === "staff"
  );
}

export function canEditListRole(role: string | null | undefined) {
  return (
    isAdminRole(role) ||
    resolverRoleUsuario(role) === "produtor"
  );
}

export function canDeleteListRole(role: string | null | undefined) {
  return isAdminRole(role);
}

export function canManageParticipantsRole(role: string | null | undefined) {
  const roleResolvido = resolverRoleUsuario(role);

  return (
    isAdminRole(role) ||
    roleResolvido === "produtor" ||
    roleResolvido === "staff"
  );
}

export function canCheckinRole(role: string | null | undefined) {
  return canManageParticipantsRole(role);
}

export function canManageEventProducersRole(role: string | null | undefined) {
  return isAdminRole(role);
}

export function canManageEventStaffRole(role: string | null | undefined) {
  return (
    isAdminRole(role) ||
    resolverRoleUsuario(role) === "produtor"
  );
}

export function canExportParticipantsRole(role: string | null | undefined) {
  return canEditEventRole(role);
}

export function roleLabel(role: string | null | undefined) {
  const roleResolvido = resolverRoleUsuario(role);

  if (roleResolvido === "platform_owner") {
    return "Proprietario da Plataforma";
  }

  if (roleResolvido === "super_admin") {
    return "Administrador Geral";
  }

  if (roleResolvido === "produtor") {
    return "Produtor";
  }

  if (roleResolvido === "staff") {
    return "Staff";
  }

  return "Operacao";
}