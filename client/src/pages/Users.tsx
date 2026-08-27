import { useState } from "react";
import { KeyRound, Pencil, Plus, Shield, Trash2, UserCheck, UserX, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { isProtectedAdminEmail, roleLabel, type AppRole } from "@shared/permissions";

type EditableRole = "engineering" | "costs";
type UserRow = {
  id: number;
  name: string | null;
  email: string | null;
  role: AppRole;
  active: boolean;
  hasPassword: boolean;
  lastSignedIn: Date;
};

const emptyCreate = { name: "", email: "", password: "", role: "engineering" as EditableRole };

export default function UsersPage() {
  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.users.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | EditableRole>("engineering");
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");

  const refresh = () => utils.users.list.invalidate();
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
    setEditRole((user.role === "admin" ? "admin" : user.role === "costs" ? "costs" : "engineering"));
    setEditActive(user.active);
    setEditPassword("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">CONTROLE DE USUÁRIOS</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Gerencie acessos e responsabilidades sem compartilhar credenciais.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-2" />NOVO USUÁRIO</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {[
          ["Administrador", "Acesso integral, usuários e cadastros", "border-blue-500/30"],
          ["Engenharia", "Documentos técnicos, sem custos ou preços", "border-cyan-500/30"],
          ["Custos", "Custos, preços e markups", "border-amber-500/30"],
        ].map(([title, description, border]) => (
          <div key={title} className={`alfalux-card p-4 ${border}`}>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
        ))}
      </div>

      <div className="alfalux-card overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead><tr className="border-b border-border/60 bg-muted/20">
              <th className="text-left p-4 text-xs tracking-wider">USUÁRIO</th>
              <th className="text-left p-4 text-xs tracking-wider">PERFIL</th>
              <th className="text-left p-4 text-xs tracking-wider">ACESSO</th>
              <th className="text-left p-4 text-xs tracking-wider">ÚLTIMO LOGIN</th>
              <th className="text-right p-4 text-xs tracking-wider">AÇÕES</th>
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td className="p-6 text-muted-foreground" colSpan={5}>Carregando usuários...</td></tr> : users.map((user) => {
                const protectedAdmin = isProtectedAdminEmail(user.email);
                return <tr key={user.email || user.id} className="border-b border-border/40 last:border-0">
                  <td className="p-4"><p className="font-medium">{user.name || "Sem nome"}</p><p className="text-xs text-muted-foreground mt-1">{user.email}</p></td>
                  <td className="p-4"><Badge variant="outline" className="gap-1"><Shield className="w-3 h-3" />{roleLabel(user.role as AppRole)}</Badge></td>
                  <td className="p-4"><div className="flex items-center gap-2 text-xs">{user.active ? <UserCheck className="w-4 h-4 text-emerald-400" /> : <UserX className="w-4 h-4 text-red-400" />}<span>{user.active ? "Ativo" : "Inativo"}</span>{user.hasPassword && <Badge variant="secondary"><KeyRound className="w-3 h-3 mr-1" />Senha</Badge>}</div></td>
                  <td className="p-4 text-xs text-muted-foreground">{user.lastSignedIn ? new Date(user.lastSignedIn).toLocaleString("pt-BR") : "—"}</td>
                  <td className="p-4"><div className="flex justify-end gap-2"><Button size="icon" variant="ghost" onClick={() => openEdit(user)} aria-label="Editar usuário"><Pencil className="w-4 h-4" /></Button><Button size="icon" variant="ghost" className="text-destructive" disabled={protectedAdmin || removeUser.isPending} onClick={() => { if (user.email && window.confirm(`Excluir o acesso de ${user.email}?`)) removeUser.mutate({ email: user.email }); }} aria-label="Excluir usuário"><Trash2 className="w-4 h-4" /></Button></div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {users.map((user) => {
          const protectedAdmin = isProtectedAdminEmail(user.email);
          return <div key={user.email || user.id} className="alfalux-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="font-medium leading-snug">{user.name || "Sem nome"}</p><p className="text-xs text-muted-foreground mt-1 break-all">{user.email}</p></div>
              <Badge variant="outline" className="gap-1 shrink-0"><Shield className="w-3 h-3" />{roleLabel(user.role as AppRole)}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border/50">
              <div className="flex items-center gap-2 text-xs">{user.active ? <UserCheck className="w-4 h-4 text-emerald-400" /> : <UserX className="w-4 h-4 text-red-400" />}<span>{user.active ? "Ativo" : "Inativo"}</span>{user.hasPassword && <Badge variant="secondary"><KeyRound className="w-3 h-3 mr-1" />Senha</Badge>}</div>
              <div className="flex gap-2"><Button size="icon" variant="ghost" onClick={() => openEdit(user)} aria-label="Editar usuário"><Pencil className="w-4 h-4" /></Button>{!protectedAdmin && <Button size="icon" variant="ghost" className="text-destructive" disabled={removeUser.isPending} onClick={() => { if (user.email && window.confirm(`Excluir o acesso de ${user.email}?`)) removeUser.mutate({ email: user.email }); }} aria-label="Excluir usuário"><Trash2 className="w-4 h-4" /></Button>}</div>
            </div>
          </div>;
        })}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent><DialogHeader><DialogTitle>Novo usuário</DialogTitle><DialogDescription>Cadastre um e-mail corporativo e uma senha temporária forte.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); createUser.mutate(createForm); }}>
            <div className="space-y-2"><Label>Nome</Label><Input value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} required /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={createForm.email} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })} placeholder="nome@grupoalfalux.com.br" required /></div>
            <div className="space-y-2"><Label>Perfil</Label><Select value={createForm.role} onValueChange={(role: EditableRole) => setCreateForm({ ...createForm, role })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="engineering">Engenharia</SelectItem><SelectItem value="costs">Custos</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Senha temporária</Label><Input type="password" autoComplete="new-password" value={createForm.password} onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })} required /><p className="text-[11px] text-muted-foreground">Mínimo de 12 caracteres, com maiúscula, minúscula, número e símbolo.</p></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button type="submit" disabled={createUser.isPending}>{createUser.isPending ? "SALVANDO..." : "CRIAR USUÁRIO"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent><DialogHeader><DialogTitle>Editar usuário</DialogTitle><DialogDescription>{editing?.email}</DialogDescription></DialogHeader>
          {editing && <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); updateUser.mutate({ email: editing.email || "", name: editName, role: editRole, active: editActive, password: editPassword || undefined }); }}>
            <div className="space-y-2"><Label>Nome</Label><Input value={editName} onChange={(event) => setEditName(event.target.value)} required /></div>
            <div className="space-y-2"><Label>Perfil</Label><Select value={editRole} disabled={isProtectedAdminEmail(editing.email)} onValueChange={(role: "admin" | EditableRole) => setEditRole(role)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{isProtectedAdminEmail(editing.email) && <SelectItem value="admin">Administrador</SelectItem>}<SelectItem value="engineering">Engenharia</SelectItem><SelectItem value="costs">Custos</SelectItem></SelectContent></Select></div>
            <label className="flex items-center gap-3 rounded-lg border border-border/60 p-3"><input type="checkbox" checked={editActive} disabled={isProtectedAdminEmail(editing.email)} onChange={(event) => setEditActive(event.target.checked)} /><span className="text-sm">Usuário ativo</span></label>
            <div className="space-y-2"><Label>Nova senha</Label><Input type="password" autoComplete="new-password" value={editPassword} onChange={(event) => setEditPassword(event.target.value)} placeholder={editing.hasPassword ? "Deixe vazio para manter" : "Defina uma senha"} /><p className="text-[11px] text-muted-foreground">Preencha apenas para definir ou trocar a senha.</p></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" disabled={updateUser.isPending}>{updateUser.isPending ? "SALVANDO..." : "SALVAR"}</Button></DialogFooter>
          </form>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
