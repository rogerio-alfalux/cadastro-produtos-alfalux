export const APP_ROLES = ["user", "admin", "engineering", "costs"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const OWNER_ADMIN_EMAIL = "rogeriojohnwayne@gmail.com";
export const GEYSA_ADMIN_EMAIL = "geysa@grupoalfalux.com.br";
export const ALLOWED_EMAIL_DOMAIN = "grupoalfalux.com.br";
export const PROTECTED_ADMIN_EMAILS = [OWNER_ADMIN_EMAIL, GEYSA_ADMIN_EMAIL] as const;

export type AppPermission =
  | "viewCatalog"
  | "manageUsers"
  | "manageEntities"
  | "manageDocuments"
  | "viewCosts"
  | "editCosts";

const ROLE_PERMISSIONS: Record<AppRole, readonly AppPermission[]> = {
  admin: ["viewCatalog", "manageUsers", "manageEntities", "manageDocuments", "viewCosts", "editCosts"],
  engineering: ["viewCatalog", "manageDocuments"],
  costs: ["viewCatalog", "viewCosts", "editCosts"],
  user: ["viewCatalog"],
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isProtectedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return (PROTECTED_ADMIN_EMAILS as readonly string[]).includes(normalizeEmail(email));
}

export function isAllowedUserEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return normalized === OWNER_ADMIN_EMAIL || normalized.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

export function can(role: AppRole | null | undefined, permission: AppPermission): boolean {
  return role ? ROLE_PERMISSIONS[role]?.includes(permission) === true : false;
}

export function roleLabel(role: AppRole | null | undefined): string {
  if (role === "admin") return "Administrador";
  if (role === "engineering") return "Engenharia";
  if (role === "costs") return "Custos";
  return "Sem perfil operacional";
}
