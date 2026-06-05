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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Wrench,
  Layers,
  Package,
  ChevronLeft,
  ChevronRight,
  Upload,
  X,
  ImageIcon,
} from "lucide-react";

const PAGE_SIZE = 50;

type AccessoryItem = {
  id: number;
  codigo: string | null;
  sku: string | null;
  produto: string | null;
  familia: string | null;
  dimensao: string | null;
  fotoUrl: string | null;
  fotoKey: string | null;
  custo: string | null;
  precoVenda: string | null;
  observacoes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const emptyForm = {
  codigo: "",
  sku: "",
  produto: "",
  familia: "",
  dimensao: "",
  custo: "",
  precoVenda: "",
  observacoes: "",
  fotoUrl: "",
  fotoKey: "",
};

export default function AccessoriesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [search, setSearch] = useState("");
  const [familiaFilter, setFamiliaFilter] = useState<string>("__all__");
  const [page, setPage] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<AccessoryItem | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<AccessoryItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<AccessoryItem | null>(null);

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // Queries
  const { data: familias = [] } = trpc.accessories.listFamilias.useQuery();

  const queryInput = useMemo(
    () => ({
      search: search.trim() || undefined,
      familia: familiaFilter === "__all__" ? undefined : familiaFilter,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [search, familiaFilter, page]
  );

  const { data, isLoading } = trpc.accessories.list.useQuery(queryInput);
  const items: AccessoryItem[] = (data?.items ?? []) as AccessoryItem[];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Mutations
  const createMutation = trpc.accessories.create.useMutation({
    onSuccess: () => {
      toast.success("Acessório criado com sucesso!");
      utils.accessories.list.invalidate();
      utils.accessories.listFamilias.invalidate();
      setDuplicateSource(null);
      setDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.accessories.update.useMutation({
    onSuccess: () => {
      toast.success("Acessório atualizado com sucesso!");
      utils.accessories.list.invalidate();
      utils.accessories.listFamilias.invalidate();
      setDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.accessories.delete.useMutation({
    onSuccess: () => {
      toast.success("Acessório excluído com sucesso!");
      utils.accessories.list.invalidate();
      utils.accessories.listFamilias.invalidate();
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
      const res = await fetch("/api/acessorios/upload-foto", { method: "POST", body: fd });
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

  function openCreate() {
    setEditItem(null);
    setDuplicateSource(null);
    setForm(emptyForm);
    setPhotoPreview(null);
    setDialogOpen(true);
  }

  function openDuplicate(item: AccessoryItem) {
    setEditItem(null);
    setDuplicateSource(item);
    setForm({
      codigo: "", // limpo para forçar novo código
      sku: item.sku ?? "",
      produto: item.produto ?? "",
      familia: item.familia ?? "",
      dimensao: item.dimensao ?? "",
      custo: item.custo ?? "",
      precoVenda: item.precoVenda ?? "",
      observacoes: item.observacoes ?? "",
      fotoUrl: item.fotoUrl ?? "",
      fotoKey: item.fotoKey ?? "",
    });
    setPhotoPreview(item.fotoUrl ?? null);
    setDialogOpen(true);
  }

  function openEdit(item: AccessoryItem) {
    setEditItem(item);
    setDuplicateSource(null);
    setForm({
      codigo: item.codigo ?? "",
      sku: item.sku ?? "",
      produto: item.produto ?? "",
      familia: item.familia ?? "",
      dimensao: item.dimensao ?? "",
      custo: item.custo ?? "",
      precoVenda: item.precoVenda ?? "",
      observacoes: item.observacoes ?? "",
      fotoUrl: item.fotoUrl ?? "",
      fotoKey: item.fotoKey ?? "",
    });
    setPhotoPreview(item.fotoUrl ?? null);
    setDialogOpen(true);
  }

  function handleSubmit() {
    const payload = {
      codigo: form.codigo || undefined,
      sku: form.sku || undefined,
      produto: form.produto || undefined,
      familia: form.familia || undefined,
      dimensao: form.dimensao || undefined,
      custo: form.custo || null,
      precoVenda: form.precoVenda || null,
      observacoes: form.observacoes || null,
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
            <Wrench className="w-5 h-5 text-primary" />
            ACESSÓRIOS
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total} {total === 1 ? "item" : "itens"} cadastrados
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            NOVO ACESSÓRIO
          </Button>
        )}
      </div>

      {/* ─── Filtros ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, SKU, produto ou família..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 text-sm"
          />
        </div>
        <Select
          value={familiaFilter}
          onValueChange={(v) => { setFamiliaFilter(v); setPage(0); }}
        >
          <SelectTrigger className="w-full sm:w-56 text-sm">
            <Layers className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Todas as famílias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as famílias</SelectItem>
            {familias.map((f) => (
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
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground tracking-wider">PRODUTO</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground tracking-wider hidden md:table-cell">SKU</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground tracking-wider hidden sm:table-cell">FAMÍLIA</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground tracking-wider hidden lg:table-cell">DIMENSÃO</th>
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
                    {[...Array(isAdmin ? 9 : 8)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-muted/40 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 9 : 8} className="px-4 py-12 text-center text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum acessório encontrado</p>
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
                          alt={item.codigo ?? ""}
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
                    <td className="px-4 py-3 font-mono text-primary font-medium">{item.codigo || "—"}</td>
                    <td className="px-4 py-3 text-foreground max-w-xs">
                      <div className="truncate" title={item.produto ?? ""}>{item.produto || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell font-mono text-[11px]">
                      {item.sku || "—"}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {item.familia ? (
                        <Badge variant="outline" className="text-[10px] font-medium">
                          {item.familia}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-[11px]">
                      {item.dimensao || "—"}
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
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            title="Duplicar acessório"
                            onClick={() => openDuplicate(item)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Editar acessório"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            title="Excluir acessório"
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
              {editItem ? "EDITAR ACESSÓRIO" : duplicateSource ? "DUPLICAR ACESSÓRIO" : "NOVO ACESSÓRIO"}
            </DialogTitle>
          </DialogHeader>

          {duplicateSource && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              <Copy className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                <span className="font-semibold">DUPLICANDO A PARTIR DE:</span>{" "}
                {duplicateSource.produto || duplicateSource.codigo || "item sem nome"}
              </span>
            </div>
          )}

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold tracking-wider">CÓDIGO</Label>
                <Input
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="AC00001"
                  className="text-sm font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold tracking-wider">SKU</Label>
                <Input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="Código do fabricante"
                  className="text-sm font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold tracking-wider">PRODUTO</Label>
              <Input
                value={form.produto}
                onChange={(e) => setForm({ ...form, produto: e.target.value })}
                placeholder="Nome/descrição do produto"
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold tracking-wider">FAMÍLIA</Label>
                <Input
                  value={form.familia}
                  onChange={(e) => setForm({ ...form, familia: e.target.value })}
                  placeholder="Ex: PERFIS, CONECTORES..."
                  className="text-sm"
                  list="familias-list"
                />
                <datalist id="familias-list">
                  {familias.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold tracking-wider">DIMENSÃO</Label>
                <Input
                  value={form.dimensao}
                  onChange={(e) => setForm({ ...form, dimensao: e.target.value })}
                  placeholder="Ex: 1000mm, 500x300mm..."
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold tracking-wider">CUSTO (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.custo}
                  onChange={(e) => setForm({ ...form, custo: e.target.value })}
                  placeholder="0,00"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold tracking-wider">PREÇO VENDA (R$)</Label>
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

            {/* ─── Observações ───────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold tracking-wider">OBSERVAÇÕES</Label>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Observações adicionais..."
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
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
              disabled={isSaving || uploading}
            >
              {isSaving ? "SALVANDO..." : editItem ? "SALVAR ALTERAÇÕES" : "CRIAR ACESSÓRIO"}
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
            Tem certeza que deseja excluir o acessório{" "}
            <span className="font-mono font-bold text-foreground">{deleteConfirm?.codigo || deleteConfirm?.produto}</span>?
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
