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
  FileSpreadsheet,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  ativo?: boolean;
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
  const isLoggedIn = !!user;

  const [search, setSearch] = useState("");
  const [familiaFilter, setFamiliaFilter] = useState<string>("__all__");
  const [page, setPage] = useState(0);
  const [filterAtivo, setFilterAtivo] = useState<"_all" | "inativos">("_all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<AccessoryItem | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<AccessoryItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<AccessoryItem | null>(null);
  const [showImport, setShowImport] = useState(false);

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
      apenasInativos: filterAtivo === "inativos" ? true : undefined,
    }),
    [search, familiaFilter, page, filterAtivo]
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

  const toggleAtivoMutation = trpc.accessories.toggleAtivo.useMutation({
    onSuccess: (_data, vars) => {
      utils.accessories.list.invalidate();
      toast.success(vars.ativo ? "Acessório ativado" : "Acessório desativado");
    },
    onError: () => toast.error("Erro ao alterar status"),
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
        {isLoggedIn && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="gap-2">
              <Upload className="w-4 h-4" />
              Importar Excel
            </Button>
            <Button size="sm" onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              NOVO ACESSÓRIO
            </Button>
          </div>
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
        <Select value={filterAtivo} onValueChange={(v) => { setFilterAtivo(v as "_all" | "inativos"); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-48 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos os status</SelectItem>
            <SelectItem value="inativos">Somente desativados</SelectItem>
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
                {isLoggedIn && (
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground tracking-wider">AÇÕES</th>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {[...Array(isLoggedIn ? 9 : 8)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-muted/40 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={isLoggedIn ? 9 : 8} className="px-4 py-12 text-center text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhum acessório encontrado</p>
                  </td>
                </tr>
              ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b border-border/30 hover:bg-muted/20 transition-colors",
                    item.ativo === false && "opacity-50"
                  )}
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
                    {isLoggedIn && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center px-0.5">
                                  <Checkbox
                                    checked={item.ativo !== false}
                                    onCheckedChange={(checked) => {
                                      toggleAtivoMutation.mutate({ id: item.id, ativo: !!checked });
                                    }}
                                    className={cn(
                                      "w-3.5 h-3.5 transition-colors",
                                      item.ativo !== false
                                        ? "border-green-500 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                        : "border-red-500/60"
                                    )}
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                {item.ativo !== false ? "Ativo — clique para desativar" : "Inativo — clique para ativar"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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
      {/* ─── Import Excel Modal ──────────────────────────────────────────────── */}
      <ImportExcelModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() => utils.accessories.list.invalidate()}
      />
    </div>
  );
}

// ─── Import Excel Modal ───────────────────────────────────────────────────────
function ImportExcelModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{
    inserted: number;
    skipped: number;
    total: number;
    errors: string[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setIsDragging(false);
    onClose();
  };

  const handleFileChange = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileChange(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/acessorios/import-excel", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao importar");
        return;
      }
      setResult(data);
      if (data.inserted > 0) {
        toast.success(`${data.inserted} acessório(s) importado(s) com sucesso!`);
        onSuccess();
      } else {
        toast.warning("Nenhum acessório novo foi inserido.");
      }
    } catch (err) {
      toast.error("Erro de rede ao importar: " + String(err));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.open("/api/acessorios/template", "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            Importar Acessórios em Massa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Template download */}
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Planilha Modelo</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Baixe o modelo com as colunas corretas e exemplos
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-2 shrink-0">
              <Download className="w-4 h-4" />
              Baixar Modelo
            </Button>
          </div>

          {/* Drop zone */}
          {!result && (
            <div
              className={cn(
                "relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                isDragging
                  ? "border-primary bg-primary/10"
                  : file
                  ? "border-emerald-500/60 bg-emerald-500/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/20"
              )}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="w-10 h-10 text-emerald-400" />
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB — clique para trocar
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-10 h-10 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Arraste o arquivo aqui</p>
                  <p className="text-xs text-muted-foreground">ou clique para selecionar (.xlsx)</p>
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-border bg-card p-3 text-center">
                  <p className="text-2xl font-bold text-foreground">{result.total}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total lidos</p>
                </div>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{result.inserted}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Inseridos</p>
                </div>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-400">{result.skipped}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ignorados</p>
                </div>
              </div>

              {result.inserted > 0 && (
                <div className="flex items-center gap-2 text-sm text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{result.inserted} acessório(s) adicionado(s) com sucesso!</span>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-amber-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{result.errors.length} aviso(s):</span>
                  </div>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 max-h-32 overflow-y-auto p-3 space-y-1">
                    {result.errors.map((e, i) => (
                      <p key={i} className="text-xs text-amber-300/80">{e}</p>
                    ))}
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => { setFile(null); setResult(null); }}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Importar outro arquivo
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Fechar</Button>
          {!result && (
            <Button
              onClick={handleImport}
              disabled={!file || isUploading}
              className="gap-2"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  Importar
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
