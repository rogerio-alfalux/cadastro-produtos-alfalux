import { useMemo, useState } from "react";
import { KeyRound, Pencil, Plus, Shield, SlidersHorizontal, Trash2, UserCheck, UserX, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  APP_PERMISSIONS,
  PERMISSION_DEFINITIONS,
  can,
  normalizePermissionOverrides,
  roleLabel,
  type AppRole,
  type PermissionOverrides,
} from "@shared/permissions";

type UserRow = {
  id: number;
  name: string | null;
  email: string | null;
  role: AppRole;
  active: boolean;
  hasPassword: boolean;
  lastSignedIn: Date;
  permissionOverrides: PermissionOverrides | null;
};

const roles: Array<{ value: AppRole; label: string }> = [
  { value: "admin", label: "Administrador" },
  { value: "engineering", label: "Engenharia" },
  { value: "costs", label: "Custos" },
  { value: "user", label: "Usuário" },
];

const emptyCreate = { name: "", email: "", password: "", role: "user" as AppRole };

function PermissionSummary({ user }: { user: UserRow }) {
  const overrides = normalizePermissionOverrides(user.permissionOverrides);
  const customCount = Object.keys(overrides).length;
  const effectiveCount = APP_PERMISSIONS.filter((permission) => can(user.role, permission, overrides)).length;
  return <p className="text-[11px] text-muted-foreground mt-1">{effectiveCount} permissões ativas{customCount > 0 ? ` · ${customCount} personalizada${customCount === 1 ? "" : "s"}` : ""}</p>;
}

export default function UsersPage() {
  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.users.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [permissionsUser, setPermissionsUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<AppRole>("user");
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");
  const [permissionOverrides, setPermissionOverrides] = useState<PermissionOverrides>({});

  const refresh = async () => {
    await Promise.all([utils.users.list.invalidate(), utils.auth.me.invalidate()]);
  };
  const createUser = trpc.users.create.useMutation({
    onSuccess: async () => {
      await refresh();
      setCreateOpen(false);
      setCreateForm(emptyCreate);
      toast.success("Usuário criado com sucesso");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateUser = trpc.users.update.useMutation({
    onSuccess: async () => {
      await refresh();
      setEditing(null);
      setPermissionsUser(null);
      toast.success("Usuário atualizado");
    },
    onError: (error) => toast.error(error.message),
  });
  const removeUser = trpc.users.remove.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Usuário excluído");
    },
    onError: (error) => toast.error(error.message),
  });

  const openEdit = (user: UserRow) => {
    setEditing(user);
    setEditName(user.name || "");
    setEditRole(user.role);
    setEditActive(user.active);
    setEditPassword("");
  };
  const openPermissions = (user: UserRow) => {
    setPermissionsUser(user);
    setPermissionOverrides(normalizePermissionOverrides(user.permissionOverrides));
  };
  const effectivePermissions = useMemo(() => {
    if (!permissionsUser) return new Set<string>();
    return new Set(APP_PERMISSIONS.filter((permission) => can(permissionsUser.role, permission, permissionOverrides)));
  }, [permissionsUser, permissionOverrides]);
  const setPermission = (permission: keyof PermissionOverrides, checked: boolean) => {
    setPermissionOverrides((current) => ({ ...current, [permission]: checked }));
  };
  const resetPermission = (permission: keyof PermissionOverrides) => {
    setPermissionOverrides((current) => {
      const next = { ...current };
      delete next[permission];
      return next;
    });
  };
  const savePermissions = () => {
    if (!permissionsUser?.email) return;
    updateUser.mutate({
      email: permissionsUser.email,
      name: permissionsUser.name || "Usuário sem nome",
      role: permissionsUser.role,
      active: permissionsUser.active,
      permissionOverrides,
    });
  };

  const renderActions = (user: UserRow) => (
    <div className="flex justify-end gap-1">
      <Button size="icon" variant="ghost" onClick={() => openEdit(user)} aria-label="Editar usuário" title="Editar usuário"><Pencil className="w-4 h-4" /></Button>
      <Button size="icon" variant="ghost" onClick={() => openPermissions(user)} aria-label="Ajustar permissões" title="Ajustar permissões"><SlidersHorizontal className="w-4 h-4" /></Button>
      <Button size="icon" variant="ghost" className="text-destructive" disabled={removeUser.isPending} onClick={() => { if (user.email && window.confirm(`Excluir o acesso de ${user.email}?`)) removeUser.mutate({ email: user.email }); }} aria-label="Excluir usuário" title="Excluir usuário"><Trash2 className="w-4 h-4" /></Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3"><Users className="w-6 h-6 text-primary" /><h1 className="text-2xl font-bold tracking-tight">CONTROLE DE USUÁRIOS</h1></div>
          <p className="text-sm text-muted-foreground mt-1">Defina o perfil-base e refine funções individuais sem compartilhar credenciais.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-2" />NOVO USUÁRIO</Button>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        {roles.map(({ value, label }) => (
          <div key={value} className="alfalux-card p-4 border-primary/20"><p className="text-sm font-semibold">{label}</p><p className="text-xs text-muted-foreground mt-1">{value === "admin" ? "Acesso integral; permissões podem ser refinadas." : value === "engineering" ? "Documentos técnicos por padrão." : value === "costs" ? "Custos, preços e markups por padrão." : "Consulta de catálogo por padrão."}</p></div>
        ))}
      </div>

      <div className="alfalux-card overflow-hidden hidden md:block"><div className="overflow-x-auto"><table className="w-full min-w-[860px]">
        <thead><tr className="border-b border-border/60 bg-muted/20"><th className="text-left p-4 text-xs tracking-wider">USUÁRIO</th><th className="text-left p-4 text-xs tracking-wider">PERFIL</th><th className="text-left p-4 text-xs tracking-wider">ACESSO</th><th className="text-left p-4 text-xs tracking-wider">ÚLTIMO LOGIN</th><th className="text-right p-4 text-xs tracking-wider">AÇÕES</th></tr></thead>
        <tbody>{isLoading ? <tr><td className="p-6 text-muted-foreground" colSpan={5}>Carregando usuários...</td></tr> : users.map((user) => <tr key={user.email || user.id} className="border-b border-border/40 last:border-0">
          <td className="p-4"><p className="font-medium">{user.name || "Sem nome"}</p><p className="text-xs text-muted-foreground mt-1">{user.email}</p><PermissionSummary user={user as UserRow} /></td>
          <td className="p-4"><Badge variant="outline" className="gap-1"><Shield className="w-3 h-3" />{roleLabel(user.role as AppRole)}</Badge></td>
          <td className="p-4"><div className="flex items-center gap-2 text-xs">{user.active ? <UserCheck className="w-4 h-4 text-emerald-400" /> : <UserX className="w-4 h-4 text-red-400" />}<span>{user.active ? "Ativo" : "Inativo"}</span>{user.hasPassword && <Badge variant="secondary"><KeyRound className="w-3 h-3 mr-1" />Senha</Badge>}</div></td>
          <td className="p-4 text-xs text-muted-foreground">{user.lastSignedIn ? new Date(user.lastSignedIn).toLocaleString("pt-BR") : "—"}</td>
          <td className="p-4">{renderActions(user as UserRow)}</td>
        </tr>)}</tbody>
      </table></div></div>

      <div className="md:hidden space-y-3">{users.map((user) => <div key={user.email || user.id} className="alfalux-card p-4">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium leading-snug">{user.name || "Sem nome"}</p><p className="text-xs text-muted-foreground mt-1 break-all">{user.email}</p><PermissionSummary user={user as UserRow} /></div><Badge variant="outline" className="gap-1 shrink-0"><Shield className="w-3 h-3" />{roleLabel(user.role as AppRole)}</Badge></div>
        <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border/50"><div className="flex items-center gap-2 text-xs">{user.active ? <UserCheck className="w-4 h-4 text-emerald-400" /> : <UserX className="w-4 h-4 text-red-400" />}<span>{user.active ? "Ativo" : "Inativo"}</span>{user.hasPassword && <Badge variant="secondary"><KeyRound className="w-3 h-3 mr-1" />Senha</Badge>}</div>{renderActions(user as UserRow)}</div>
      </div>)}</div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Novo usuário</DialogTitle><DialogDescription>Cadastre um e-mail corporativo, senha temporária forte e perfil-base.</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); createUser.mutate(createForm); }}>
          <div className="space-y-2"><Label>Nome</Label><Input value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} required /></div>
          <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} placeholder="nome@grupoalfalux.com.br" required /></div>
          <div className="space-y-2"><Label>Perfil</Label><Select value={createForm.role} onValueChange={(role: AppRole) => setCreateForm({ ...createForm, role })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Senha temporária</Label><Input type="password" autoComplete="new-password" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} required /><p className="text-[11px] text-muted-foreground">Mínimo de 12 caracteres, com maiúscula, minúscula, número e símbolo.</p></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button type="submit" disabled={createUser.isPending}>{createUser.isPending ? "SALVANDO..." : "CRIAR USUÁRIO"}</Button></DialogFooter>
        </form>
      </DialogContent></Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}><DialogContent><DialogHeader><DialogTitle>Editar usuário</DialogTitle><DialogDescription>{editing?.email}</DialogDescription></DialogHeader>
        {editing && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); updateUser.mutate({ email: editing.email || "", name: editName, role: editRole, active: editActive, password: editPassword || undefined, permissionOverrides: normalizePermissionOverrides(editing.permissionOverrides) }); }}>
          <div className="space-y-2"><Label>Nome</Label><Input value={editName} onChange={(event) => setEditName(event.target.value)} required /></div>
          <div className="space-y-2"><Label>Perfil-base</Label><Select value={editRole} onValueChange={(role: AppRole) => setEditRole(role)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{roles.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}</SelectContent></Select><p className="text-[11px] text-muted-foreground">Administradores podem atribuir qualquer perfil, inclusive Administrador.</p></div>
          <label className="flex items-center gap-3 rounded-lg border border-border/60 p-3"><input type="checkbox" checked={editActive} onChange={(event) => setEditActive(event.target.checked)} /><span className="text-sm">Usuário ativo</span></label>
          <div className="space-y-2"><Label>Nova senha</Label><Input type="password" autoComplete="new-password" value={editPassword} onChange={(event) => setEditPassword(event.target.value)} placeholder={editing.hasPassword ? "Deixe vazio para manter" : "Defina uma senha"} /><p className="text-[11px] text-muted-foreground">Preencha apenas para definir ou trocar a senha.</p></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" disabled={updateUser.isPending}>{updateUser.isPending ? "SALVANDO..." : "SALVAR"}</Button></DialogFooter>
        </form>}
      </DialogContent></Dialog>

      <Dialog open={!!permissionsUser} onOpenChange={(open) => !open && setPermissionsUser(null)}><DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Permissões — {permissionsUser?.name || "Usuário"}</DialogTitle><DialogDescription>As permissões abaixo têm precedência sobre o perfil-base e são aplicadas imediatamente após salvar.</DialogDescription></DialogHeader>
        <div className="space-y-2">{PERMISSION_DEFINITIONS.map((permission) => {
          const isOverridden = typeof permissionOverrides[permission.key] === "boolean";
          const checked = effectivePermissions.has(permission.key);
          return <div key={permission.key} className="rounded-lg border border-border/60 p-3.5 transition-colors hover:bg-muted/20"><div className="flex items-start gap-3"><input id={`permission-${permission.key}`} type="checkbox" className="mt-1 h-4 w-4 accent-primary" checked={checked} onChange={(event) => setPermission(permission.key, event.target.checked)} /><div className="min-w-0 flex-1"><label htmlFor={`permission-${permission.key}`} className="text-sm font-semibold cursor-pointer">{permission.label}</label><p className="text-xs text-muted-foreground mt-1 leading-relaxed">{permission.description}</p><div className="flex items-center gap-2 mt-2">{isOverridden ? <><Badge variant="secondary">Atribuição individual</Badge><button type="button" className="text-[11px] text-primary hover:underline" onClick={() => resetPermission(permission.key)}>Restaurar perfil</button></> : <Badge variant="outline">Padrão do perfil</Badge>}</div></div></div></div>;
        })}</div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setPermissionsUser(null)}>Cancelar</Button><Button onClick={savePermissions} disabled={updateUser.isPending}>{updateUser.isPending ? "SALVANDO..." : "SALVAR PERMISSÕES"}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
