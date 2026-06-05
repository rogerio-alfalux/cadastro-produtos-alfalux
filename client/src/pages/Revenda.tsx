import { useState, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ShoppingCart,
  Building2,
  Package,
  ChevronLeft,
  ChevronRight,
  Upload,
  X,
  ImageIcon,
} from "lucide-react";

const PAGE_SIZE = 50;

type RevendaItem = {
  id: number;
  codigo: string;
  descricao: string;
  referencia: string | null;
  fornecedor: string | null;
  observacoes: string | null;
  fotoUrl: string | null;
  fotoKey: string | null;
  custo: string | null;
  precoVenda: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const IPI  = 0.0975;
const ST   = 0.1104;
const MULT = 1.6;

function calcularPrecoVenda(custo: string, fornecedor: string): string {
  const n = parseFloat(custo);
  if (isNaN(n) || n <= 0) return "";
  const forn = fornecedor.toUpperCase();
  let preco: number;
  if (forn.includes("REVOLUZ")) {
    preco = Math.round(n * (1 + IPI) * (1 + ST) * MULT * 100) / 100;
  } else {
    preco = Math.round(n * MULT * 100) / 100;
  }
  return preco.toFixed(2);
}

const emptyForm = {
  codigo: "",
  descricao: "",
  referencia: "",
  fornecedor: "",
  observacoes: "",
  custo: "",
  precoVenda: "",
  fotoUrl: "",
  fotoKey: "",
};

export default function RevendaPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [search, setSearch] = useState("");
  const [fornecedorFilter, setFornecedorFilter] = useState<string>("__all__");
  const [page, setPage] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<RevendaItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<RevendaItem | null>(null);

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // Queries
  const { data: fornecedores = [] } = trpc.revenda.listFornecedores.useQuery();

  const queryInput = useMemo(
    () => ({
      search: search.trim() || undefined,
      fornecedor: fornecedorFilter === "__all__" ? undefined : fornecedorFilter,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [search, fornecedorFilter, page]
  );

  const { data, isLoading } = trpc.revenda.list.useQuery(queryInput);
  const items: RevendaItem[] = (data?.items ?? []) as RevendaItem[];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Mutations
  const createMutation = trpc.revenda.create.useMutation({
    onSuccess: () => {
      toast.success("Item criado com sucesso!");
      utils.revenda.list.invalidate();
      utils.revenda.listFornecedores.invalidate();
      setDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.revenda.update.useMutation({
    onSuccess: () => {
      toast.success("Item atualizado com sucesso!");
      utils.revenda.list.invalidate();
      utils.revenda.listFornecedores.invalidate();
      setDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.revenda.delete.useMutation({
    onSuccess: () => {
      toast.success("Item excluído com sucesso!");
      utils.revenda.list.invalidate();
      utils.revenda.listFornecedores.invalidate();
      setDeleteConfirm(null);
    },
    onError: (err) => toast.error(err.message),
  });

  // Photo upload handler
  async function handlePhotoUpload(file: File) {
    if (!file) return;
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Apenas arquivos JPEG, JPG, PNG e WEBP são aceitos");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 10MB");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/revenda/upload-foto", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        setForm((prev) => ({ ...prev, fotoUrl: data.url, fotoKey: data.key }));
        setPhotoPreview(data.url);
        toast.success("Foto enviada com sucesso!");
      } else {
        toast.error(data.error || "Erro ao enviar foto");
      }
    } catch {
      toast.error("Erro ao enviar foto");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto() {
    setPhotoPreview(null);
    setForm((prev) => ({ ...prev, fotoUrl: "", fotoKey: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Handlers
  function openCreate() {
    setEditItem(null);
    setForm(emptyForm);
    setPhotoPreview(null);
    setDialogOpen(true);
  }

  function openEdit(item: RevendaItem) {
    setEditItem(item);
    setForm({
      codigo: item.codigo,
      descricao: item.descricao,
      referencia: item.referencia ?? "",
      fornecedor: item.fornecedor ?? "",
      observacoes: item.observacoes ?? "",
      custo: item.custo ?? "",
      precoVenda: item.precoVenda ?? "",
      fotoUrl: item.fotoUrl ?? "",
      fotoKey: item.fotoKey ?? "",
    });
    setPhotoPreview(item.fotoUrl ?? null);
    setDialogOpen(true);
  }

  function handleSubmit() {
    const payload = {
      codigo: form.codigo,
      descricao: form.descricao,
      referencia: form.referencia || null,
      fornecedor: form.fornecedor || null,
      observacoes: form.observacoes || null,
      custo: form.custo || null,
      precoVenda: form.precoVenda || null,
      fotoUrl: form.fotoUrl || null,
      fotoKey: form.fotoKey || null,
    };
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  function formatCurrency(val: string | null | undefined) {
    if (!val) return "—";
    const n = parseFloat(val);
    if (isNaN(n)) return "—";
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            PRODUTOS DE REVENDA
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total} {total === 1 ? "item" : "itens"} cadastrados
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            NOVO ITEM
          </Button>
        )}
      </div>

      {/* ─── Filtros ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, descrição ou referência..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 text-sm"
          />
        </div>
        <Select
          value={fornecedorFilter}
          onValueChange={(v) => { setFornecedorFilter(v); setPage(0); }}
        >
          <SelectTrigger className="w-full sm:w-56 text-sm">
            <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Todos os fornecedores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os fornecedores</SelectItem>
            {fornecedores.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ─── Tabela ─────────────────────────────────────────────────────────── */}
      <div className="border border-border/50 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground tracking-wider w-12">FOTO</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground tracking-wider">CÓDIGO</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground tracking-wider">DESCRIÇÃO</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground tracking-wider hidden md:table-cell">REFERÊNCIA</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground tracking-wider hidden sm:table-cell">FORNECEDOR</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground tracking-wider hidden lg:table-cell">CUSTO</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground tracking-wider hidden lg:table-cell">PREÇO VENDA</th>
                {isAdmin && (
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground tracking-wider">AÇÕES</th>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {[...Array(isAdmin ? 8 : 7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-muted/40 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 8 : 7} className="px-4 py-12 text-center text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum item encontrado</p>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-3 py-2">
                      {item.fotoUrl ? (
                        <img
                          src={item.fotoUrl}
                          alt={item.codigo}
                          className="w-10 h-10 object-contain rounded border border-border/40 bg-white cursor-pointer hover:scale-150 transition-transform duration-200"
                          onClick={() => window.open(item.fotoUrl!, "_blank")}
                          title="Clique para ampliar"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded border border-border/30 bg-muted/20 flex items-center justify-center">
                          <Package className="w-4 h-4 text-muted-foreground/30" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-primary font-medium">{item.codigo}</td>
                    <td className="px-4 py-3 text-foreground max-w-xs">
                      <div className="truncate" title={item.descricao}>{item.descricao}</div>
                      {item.observacoes && (
                        <div className="text-muted-foreground text-[10px] truncate mt-0.5" title={item.observacoes}>
                          {item.observacoes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell font-mono text-[11px]">
                      {item.referencia || "—"}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {item.fornecedor ? (
                        <Badge variant="outline" className="text-[10px] font-medium">
                          {item.fornecedor}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {formatCurrency(item.custo)}
                    </td>
                    <td className="px-4 py-3 font-medium hidden lg:table-cell">
                      {formatCurrency(item.precoVenda)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm(item)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Paginação ──────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Exibindo {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span>
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Dialog Criar/Editar ─────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold tracking-wider">
              {editItem ? "EDITAR ITEM DE REVENDA" : "NOVO ITEM DE REVENDA"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold tracking-wider">CÓDIGO *</Label>
                <Input
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="RV00001"
                  className="text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold tracking-wider">REFERÊNCIA</Label>
                <Input
                  value={form.referencia}
                  onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                  placeholder="Ref. do fabricante"
                  className="text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold tracking-wider">DESCRIÇÃO *</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Descrição completa do produto"
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold tracking-wider">FORNECEDOR</Label>
              <Input
                value={form.fornecedor}
                onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
                placeholder="Nome do fornecedor"
                className="text-sm"
                list="fornecedores-list"
              />
              <datalist id="fornecedores-list">
                {fornecedores.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold tracking-wider">CUSTO (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.custo}
                  onChange={(e) => {
                    const custo = e.target.value;
                    const preco = calcularPrecoVenda(custo, form.fornecedor);
                    setForm({ ...form, custo, precoVenda: preco });
                  }}
                  placeholder="0,00"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold tracking-wider">
                  PREÇO VENDA (R$)
                  <span className="ml-1 text-[10px] text-muted-foreground font-normal">(calculado)</span>
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.precoVenda}
                  onChange={(e) => setForm({ ...form, precoVenda: e.target.value })}
                  placeholder="0,00"
                  className="text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold tracking-wider">OBSERVAÇÕES</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Informações adicionais..."
                className="text-sm resize-none"
                rows={3}
              />
            </div>

            {/* ─── Foto ─────────────────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" />
                FOTO DO PRODUTO
                <span className="text-[10px] text-muted-foreground font-normal ml-1">OPCIONAL — JPEG, JPG, PNG</span>
              </Label>

              <div className="flex items-start gap-4">
                {/* Preview */}
                <div
                  className={`w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center overflow-hidden flex-shrink-0 transition-colors ${
                    photoPreview
                      ? "border-primary/40"
                      : "border-border hover:border-primary/40 cursor-pointer"
                  }`}
                  onClick={() => !photoPreview && fileInputRef.current?.click()}
                >
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <ImageIcon className="w-6 h-6 opacity-40" />
                      <span className="text-[9px] tracking-wider">SEM FOTO</span>
                    </div>
                  )}
                </div>

                {/* Upload area */}
                <div className="flex-1">
                  <div
                    className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) handlePhotoUpload(file);
                    }}
                  >
                    <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />
                    <p className="text-xs text-muted-foreground">
                      {uploading ? "Enviando..." : "Arraste ou clique para selecionar"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">JPEG, JPG, PNG — máx. 10MB</p>
                  </div>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="mt-1.5 text-xs text-destructive hover:text-destructive/80 flex items-center gap-1 transition-colors"
                    >
                      <X className="w-3 h-3" /> Remover foto
                    </button>
                  )}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file);
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              CANCELAR
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSaving || !form.codigo.trim() || !form.descricao.trim() || uploading}
            >
              {isSaving ? "SALVANDO..." : editItem ? "SALVAR ALTERAÇÕES" : "CRIAR ITEM"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Confirmar Exclusão ───────────────────────────────────────── */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold tracking-wider text-destructive">
              CONFIRMAR EXCLUSÃO
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir o item{" "}
            <span className="font-mono font-bold text-foreground">{deleteConfirm?.codigo}</span>?
            Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>
              CANCELAR
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteConfirm && deleteMutation.mutate({ id: deleteConfirm.id })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "EXCLUINDO..." : "EXCLUIR"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
