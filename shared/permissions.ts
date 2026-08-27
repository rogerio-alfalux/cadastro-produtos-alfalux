export const APP_ROLES = ["user", "admin", "engineering", "costs"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const OWNER_ADMIN_EMAIL = "rogeriojohnwayne@gmail.com";
export const GEYSA_ADMIN_EMAIL = "geysa@grupoalfalux.com.br";
export const ALLOWED_EMAIL_DOMAIN = "grupoalfalux.com.br";
export const PROTECTED_ADMIN_EMAILS = [OWNER_ADMIN_EMAIL, GEYSA_ADMIN_EMAIL] as const;

export const APP_PERMISSIONS = [
  "viewCatalog",
  "manageUsers",
  "manageEntities",
  "manageDocuments",
  "viewCosts",
  "editCosts",
] as const;
export type AppPermission = (typeof APP_PERMISSIONS)[number];
export type PermissionOverrides = Partial<Record<AppPermission, boolean>>;

export const PERMISSION_DEFINITIONS: ReadonlyArray<{
  key: AppPermission;
  label: string;
  description: string;
}> = [
  { key: "viewCatalog", label: "Consultar Catálogo", description: "Visualizar produtos, componentes, acessórios e revenda." },
  { key: "manageUsers", label: "Gerenciar Usuários", description: "Criar, editar, ativar e excluir acessos, perfis e permissões." },
  { key: "manageEntities", label: "Gerenciar Cadastros", description: "Criar, editar, ativar, desativar e excluir produtos, componentes, acessórios e revenda." },
  { key: "manageDocuments", label: "Gerenciar Documentos", description: "Enviar, substituir e remover Datasheets, fotometrias IES e desenhos técnicos." },
  { key: "viewCosts", label: "Ver Custos e Preços", description: "Visualizar custos, preços de venda e markups." },
  { key: "editCosts", label: "Editar Custos e Markups", description: "Alterar custos, preços de venda e markups autorizados." },
];

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

export function normalizePermissionOverrides(raw: unknown): PermissionOverrides {
  let candidate = raw;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return {};
    }
  }
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return {};

  const source = candidate as Record<string, unknown>;
  const normalized: PermissionOverrides = {};
  for (const permission of APP_PERMISSIONS) {
    if (typeof source[permission] === "boolean") normalized[permission] = source[permission] as boolean;
  }
  return normalized;
}

export function can(
  role: AppRole | null | undefined,
  permission: AppPermission,
  permissionOverrides?: unknown,
): boolean {
  if (!role) return false;
  // A gestão de acessos permite conceder ou retirar privilégios e, portanto,
  // permanece exclusiva de usuários cujo perfil-base é Administrador.
  if (permission === "manageUsers" && role !== "admin") return false;
  const overrides = normalizePermissionOverrides(permissionOverrides);
  if (typeof overrides[permission] === "boolean") return overrides[permission] as boolean;
  return ROLE_PERMISSIONS[role]?.includes(permission) === true;
}

export function effectivePermissions(role: AppRole | null | undefined, permissionOverrides?: unknown): AppPermission[] {
  return APP_PERMISSIONS.filter((permission) => can(role, permission, permissionOverrides));
}

export function roleLabel(role: AppRole | null | undefined): string {
  if (role === "admin") return "Administrador";
  if (role === "engineering") return "Engenharia";
  if (role === "costs") return "Custos";
  return "Sem perfil operacional";
}
