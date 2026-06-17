import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, RefreshCw, Search, ChevronDown, ChevronUp, Package, Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, CheckSquare2, Camera, X as XIcon, ImageIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type ComponentType =
  | "DRIVER_ONOFF_220"
  | "DRIVER_ONOFF_BIVOLT"
  | "DRIVER_DIM_110V"
  | "DRIVER_DIM_DALI"
  | "DRIVER_DIM_TRIAC_110V"
  | "DRIVER_DIM_TRIAC_220V"
  | "OTICA"
  | "HOLDER"
  | "DISSIPADOR"
  | "MODULO_LED";

const COMPONENT_TYPES: { value: ComponentType; label: string }[] = [
  { value: "DRIVER_ONOFF_220", label: "Driver ON/OFF 220V" },
  { value: "DRIVER_ONOFF_BIVOLT", label: "Driver ON/OFF Bivolt" },
  { value: "DRIVER_DIM_110V", label: "Driver Dim 1-10V" },
  { value: "DRIVER_DIM_DALI", label: "Driver Dim DALI" },
  { value: "DRIVER_DIM_TRIAC_110V", label: "Driver Dim Triac 110V" },
  { value: "DRIVER_DIM_TRIAC_220V", label: "Driver Dim Triac 220V" },
  { value: "OTICA", label: "Ótica" },
  { value: "HOLDER", label: "Holder" },
  { value: "DISSIPADOR", label: "Dissipador" },
  { value: "MODULO_LED", label: "Módulo LED" },
];

interface ComponentRow {
  id: number;
  tipo: string;
  modelo: string;
  codigo: string | null;
  observacao: string | null;
  custo: string | null;
  fotoUrl: string | null;
  fotoKey: string | null;
}

interface FormState {
  tipo: ComponentType | "";
  modelo: string;
  codigo: string;
  observacao: string;
  custo: string;
  fotoUrl: string;
  fotoKey: string;
}

const EMPTY_FORM: FormState = {
  tipo: "",
  modelo: "",
  codigo: "",
  observacao: "",
  custo: "",
  fotoUrl: "",
  fotoKey: "",
};

// ─── Autocomplete for Modelo field ───────────────────────────────────────────
function ModeloAutocomplete({
  value,
  tipo,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  tipo: ComponentType | "";
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: suggestions = [] } = trpc.components.searchByTipo.useQuery(
    { tipo: tipo as ComponentType, query: value },
    { enabled: !!tipo && value.length >= 1, staleTime: 10_000 }
  );

  const filtered = suggestions.filter(
    (s) => s.toUpperCase() !== value.toUpperCase()
  );

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const updateRect = () => {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          updateRect();
          setOpen(true);
        }}
        onFocus={() => {
          updateRect();
          if (value.length >= 1) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && filtered.length > 0 && rect && (
        <ul
          style={{
            position: "fixed",
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 9999,
          }}
          className="bg-popover border border-border rounded-lg shadow-xl max-h-56 overflow-y-auto py-1"
        >
          {filtered.map((s) => (
            <li
              key={s}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                setOpen(false);
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Bulk Replace Modal ───────────────────────────────────────────────────────
function BulkReplaceModal({
  open,
  onClose,
  families,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  families: string[];
  onSuccess: () => void;
}) {
  const [tipo, setTipo] = useState<ComponentType | "">("");
  const [componenteAtual, setComponenteAtual] = useState("");
  const [novoComponente, setNovoComponente] = useState("");
  const [familia, setFamilia] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { data: preview } = trpc.bulkOps.previewReplaceComponent.useQuery(
    { tipo: tipo as ComponentType, componenteAtual, familia: familia || undefined },
    { enabled: !!tipo && componenteAtual.length >= 2, staleTime: 5_000 }
  );

  const applyMut = trpc.bulkOps.applyReplaceComponent.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.updated} produto(s) atualizado(s) com sucesso!`);
      onSuccess();
      handleClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleClose = () => {
    setTipo("");
    setComponenteAtual("");
    setNovoComponente("");
    setFamilia("");
    setConfirmed(false);
    onClose();
  };

  const count = preview?.count ?? 0;
  const canApply = !!tipo && componenteAtual.length >= 2 && novoComponente.length >= 2 && count > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Alteração em Massa de Componente</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Substitua um componente em todos os produtos que o utilizam, com opção de filtrar por família.
          </p>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo de Componente *</Label>
            <Select
              value={tipo}
              onValueChange={(v) => { setTipo(v as ComponentType); setComponenteAtual(""); setNovoComponente(""); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo..." />
              </SelectTrigger>
              <SelectContent>
                {COMPONENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Modelo Antigo */}
          <div className="space-y-1.5">
            <Label>Componente Atual (a substituir) *</Label>
            <ModeloAutocomplete
              value={componenteAtual}
              tipo={tipo}
              onChange={setComponenteAtual}
              placeholder="Digite para buscar..."
              disabled={!tipo}
            />
            {preview !== undefined && componenteAtual.length >= 2 && (
              <p className={cn("text-xs mt-1", count > 0 ? "text-amber-400" : "text-muted-foreground")}>
                {count > 0
                  ? `⚠ ${count} produto(s) utilizam este componente${familia ? ` na família ${familia}` : ""}` 
                  : "Nenhum produto encontrado com este componente"}
              </p>
            )}
          </div>

          {/* Modelo Novo */}
          <div className="space-y-1.5">
            <Label>Novo Componente *</Label>
            <ModeloAutocomplete
              value={novoComponente}
              tipo={tipo}
              onChange={setNovoComponente}
              placeholder="Digite para buscar ou inserir novo..."
              disabled={!tipo}
            />
          </div>

          {/* Família (opcional) */}
          <div className="space-y-1.5">
            <Label>Filtrar por Família <span className="text-muted-foreground text-xs">(opcional — deixe em branco para alterar em todos)</span></Label>
            <Select
              value={familia || "ALL"}
              onValueChange={(v) => setFamilia(v === "ALL" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas as famílias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas as famílias</SelectItem>
                {families.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Preview table */}
          {preview && count > 0 && (
            <div className="space-y-2">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                <strong>Resumo:</strong> O componente <em>{componenteAtual}</em> será substituído por <em>{novoComponente}</em> em{" "}
                <strong>{count} produto(s)</strong>{familia ? ` da família ${familia}` : ""}.
              </div>
              {preview.produtos.length > 0 && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Produtos afetados (primeiros {preview.produtos.length} de {count})
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-border/50">
                    {preview.produtos.map((p: { produto: string; familia: string }) => (
                      <div key={p.produto} className="px-4 py-2 text-sm flex justify-between">
                        <span className="text-foreground">{p.produto}</span>
                        <span className="text-muted-foreground text-xs">{p.familia}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Confirmation checkbox */}
          {canApply && (
            <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="rounded"
              />
              Confirmo que desejo substituir o componente nos {count} produto(s) listados
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={() => applyMut.mutate({ tipo: tipo as ComponentType, componenteAtual, novoComponente, familia: familia || undefined })}
            disabled={applyMut.isPending || !canApply || !confirmed}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {applyMut.isPending ? "Atualizando..." : `Substituir em ${count} produto(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Components() {
  const utils = trpc.useUtils();

  // ─── Filters ─────────────────────────────────────────────────────────────
  const [filterTipo, setFilterTipo] = useState<ComponentType | "ALL">("ALL");
  const [filterSearch, setFilterSearch] = useState("");

  // ─── Data ─────────────────────────────────────────────────────────────────
  const { data: allComponents = [], isLoading } = trpc.components.list.useQuery(
    filterTipo !== "ALL" ? { tipo: filterTipo } : {},
    { staleTime: 30_000 }
  );

  const { data: families = [] } = trpc.components.families.useQuery(undefined, { staleTime: 60_000 });

  const filtered = useMemo(() => {
    if (!filterSearch.trim()) return allComponents;
    const q = filterSearch.toUpperCase();
    return allComponents.filter(
      (c) =>
        c.modelo.toUpperCase().includes(q) ||
        (c.codigo && c.codigo.toUpperCase().includes(q)) ||
        (c.observacao && c.observacao.toUpperCase().includes(q))
    );
  }, [allComponents, filterSearch]);

  // ─── CRUD mutations ───────────────────────────────────────────────────────
  const createMut = trpc.components.create.useMutation({
    onSuccess: () => { utils.components.list.invalidate(); toast.success("Componente criado com sucesso!"); setShowForm(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.components.update.useMutation({
    onSuccess: () => { utils.components.list.invalidate(); toast.success("Componente atualizado!"); setShowForm(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.components.delete.useMutation({
    onSuccess: () => { utils.components.list.invalidate(); toast.success("Componente excluído!"); setDeleteTarget(null); },
    onError: (e) => toast.error(e.message),
  });

  // ─── Form dialog ──────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ComponentRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Verificação de código duplicado em tempo real
  const codigoParaVerificar = form.codigo.trim().length >= 2 ? form.codigo.trim().toUpperCase() : null;
  const { data: codigoConflito } = trpc.components.checkCodigo.useQuery(
    { codigo: codigoParaVerificar!, excludeId: editTarget?.id },
    { enabled: !!codigoParaVerificar && showForm, staleTime: 1500 }
  );
  const codigoEmUso = !!codigoConflito?.exists;

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (c: ComponentRow) => {
    setEditTarget(c);
    setForm({
      tipo: c.tipo as ComponentType,
      modelo: c.modelo,
      codigo: c.codigo ?? "",
      observacao: c.observacao ?? "",
      custo: c.custo ?? "",
      fotoUrl: c.fotoUrl ?? "",
      fotoKey: c.fotoKey ?? "",
    });
    setShowForm(true);
  };


  const handleSave = () => {
    if (!form.tipo || !form.modelo.trim()) {
      toast.error("Tipo e Modelo são obrigatórios.");
      return;
    }
    if (codigoEmUso) {
      toast.error(`Código "${form.codigo.trim().toUpperCase()}" já está em uso pelo componente: ${codigoConflito?.modelo}`);
      return;
    }
    if (editTarget) {
      updateMut.mutate({ id: editTarget.id, modelo: form.modelo, codigo: form.codigo, observacao: form.observacao, custo: form.custo, fotoUrl: form.fotoUrl || undefined, fotoKey: form.fotoKey || undefined });
    } else {
      createMut.mutate({ tipo: form.tipo as ComponentType, modelo: form.modelo, codigo: form.codigo, observacao: form.observacao, custo: form.custo, fotoUrl: form.fotoUrl || undefined, fotoKey: form.fotoKey || undefined });
    }
  };

  // ─── Delete dialog ────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<ComponentRow | null>(null);

  // ─── Bulk delete (exclusão em massa) ─────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteManyConfirm1, setDeleteManyConfirm1] = useState(false);
  const [deleteManyConfirm2, setDeleteManyConfirm2] = useState(false);
  const deleteManyMut = trpc.components.deleteMany.useMutation({
    onSuccess: (data) => {
      utils.components.list.invalidate();
      toast.success(`${data.deleted} componente(s) excluído(s) com sucesso!`);
      setSelectedIds(new Set());
      setDeleteManyConfirm1(false);
      setDeleteManyConfirm2(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectGroup = (items: ComponentRow[]) => {
    const allSelected = items.every((c) => selectedIds.has(c.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        items.forEach((c) => next.delete(c.id));
      } else {
        items.forEach((c) => next.add(c.id));
      }
      return next;
    });
  };

  // ─── Bulk replace dialog ──────────────────────────────────────────────────
  const [showBulk, setShowBulk] = useState(false);

  // ─── Import Excel dialog ─────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);

  // ─── Foto modal ─────────────────────────────────────────────────────────────
  const [fotoTarget, setFotoTarget] = useState<ComponentRow | null>(null);
  const [fotoUploading, setFotoUploading] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  // ─── Foto no formulário de criação/edição ────────────────────────────────
  const [formFotoUploading, setFormFotoUploading] = useState(false);
  const formFotoInputRef = useRef<HTMLInputElement>(null);

  const handleFormFotoUpload = async (file: File) => {
    setFormFotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/components/upload-foto", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) { toast.error(uploadData.error ?? "Erro ao fazer upload"); return; }
      setForm((p) => ({ ...p, fotoUrl: uploadData.url, fotoKey: uploadData.key }));
      toast.success("Foto carregada!");
    } catch (err) {
      toast.error("Erro de rede: " + String(err));
    } finally {
      setFormFotoUploading(false);
    }
  };

  const handleFormFotoRemove = async () => {
    // Se estiver editando um componente existente, remove do servidor também
    if (editTarget && form.fotoKey) {
      try {
        await fetch(`/api/components/${editTarget.id}/foto`, { method: "DELETE" });
      } catch (_) { /* ignore */ }
    }
    setForm((p) => ({ ...p, fotoUrl: "", fotoKey: "" }));
  };

  const handleFotoUpload = async (file: File) => {
    if (!fotoTarget) return;
    setFotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/components/upload-foto", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) { toast.error(uploadData.error ?? "Erro ao fazer upload"); return; }
      const saveRes = await fetch(`/api/components/${fotoTarget.id}/foto`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: uploadData.url, key: uploadData.key }),
      });
      if (!saveRes.ok) { toast.error("Erro ao salvar referência da foto"); return; }
      toast.success("Foto salva com sucesso!");
      utils.components.list.invalidate();
      setFotoTarget((prev) => prev ? { ...prev, fotoUrl: uploadData.url, fotoKey: uploadData.key } : null);
    } catch (err) {
      toast.error("Erro de rede: " + String(err));
    } finally {
      setFotoUploading(false);
    }
  };

  const handleFotoRemove = async () => {
    if (!fotoTarget) return;
    setFotoUploading(true);
    try {
      const res = await fetch(`/api/components/${fotoTarget.id}/foto`, { method: "DELETE" });
      if (!res.ok) { toast.error("Erro ao remover foto"); return; }
      toast.success("Foto removida!");
      utils.components.list.invalidate();
      setFotoTarget((prev) => prev ? { ...prev, fotoUrl: null, fotoKey: null } : null);
    } catch (err) {
      toast.error("Erro de rede: " + String(err));
    } finally {
      setFotoUploading(false);
    }
  };

  // ─── "Ver produtos" modal ──────────────────────────────────────────────────
  const [productsTarget, setProductsTarget] = useState<ComponentRow | null>(null);
  const { data: productsUsing = [], isFetching: loadingProducts } = trpc.components.getProductsUsing.useQuery(
    { tipo: productsTarget?.tipo as ComponentType, modelo: productsTarget?.modelo ?? "" },
    { enabled: !!productsTarget, staleTime: 10_000 }
  );

  // ─── Group by tipo ────────────────────────────────────────────────────────
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(COMPONENT_TYPES.map((t) => t.value)));
  const toggleGroup = (tipo: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(tipo) ? next.delete(tipo) : next.add(tipo);
      return next;
    });
  };

  const grouped = useMemo(() => {
    const map = new Map<string, ComponentRow[]>();
    for (const c of filtered) {
      if (!map.has(c.tipo)) map.set(c.tipo, []);
      map.get(c.tipo)!.push(c);
    }
    return map;
  }, [filtered]);

  const tipoLabel = (tipo: string) => COMPONENT_TYPES.find((t) => t.value === tipo)?.label ?? tipo;

  return (
    <>
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">COMPONENTES</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gerencie drivers, óticas, holders, dissipadores e módulos LED
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setShowBulk(true)} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Alteração em Massa
            </Button>
            <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
              <Upload className="w-4 h-4" />
              Importar Excel
            </Button>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Componente
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 bg-card border-border"
              placeholder="Buscar por modelo ou código..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>
          <Select value={filterTipo} onValueChange={(v) => setFilterTipo(v as ComponentType | "ALL")}>
            <SelectTrigger className="w-56 bg-card border-border">
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os tipos</SelectItem>
              {COMPONENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Component groups */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum componente encontrado. Clique em "Novo Componente" para começar.
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([tipo, items]) => (
              <div key={tipo} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Group header */}
                <button
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
                  onClick={() => toggleGroup(tipo)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground">{tipoLabel(tipo)}</span>
                    <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                      {items.length} {items.length === 1 ? "item" : "itens"}
                    </span>
                  </div>
                  {expandedGroups.has(tipo) ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>

                {/* Group rows */}
                {expandedGroups.has(tipo) && (
                  <div className="divide-y divide-border/50">
                    {/* Column header */}
                    <div className="grid gap-3 px-5 py-2 bg-muted/20 text-[10px] text-muted-foreground uppercase tracking-wider font-medium" style={{gridTemplateColumns:'28px 44px 1fr 90px 140px 70px 100px'}}>
                      <div className="flex items-center">
                        <Checkbox
                          checked={items.every((c) => selectedIds.has(c.id))}
                          onCheckedChange={() => toggleSelectGroup(items)}
                          aria-label="Selecionar todos do grupo"
                          className="w-3.5 h-3.5"
                        />
                      </div>
                      <div></div>
                      <div>Modelo</div>
                      <div>Código</div>
                      <div>Observação</div>
                      <div className="text-right">Custo</div>
                      <div />
                    </div>
                    {items.map((c) => (
                      <div
                        key={c.id}
                        className={cn(
                          "grid gap-3 px-5 py-2 items-center hover:bg-muted/10 transition-colors",
                          "[grid-template-columns:28px_44px_1fr_90px_140px_70px_100px]",
                          selectedIds.has(c.id) && "bg-destructive/5"
                        )}
                      >
                        <div className="flex items-center">
                          <Checkbox
                            checked={selectedIds.has(c.id)}
                            onCheckedChange={() => toggleSelect(c.id)}
                            aria-label={`Selecionar ${c.modelo}`}
                            className="w-3.5 h-3.5"
                          />
                        </div>
                        {/* Foto — lado esquerdo, como nos produtos */}
                        <div className="flex items-center">
                          <button
                            onClick={() => setFotoTarget(c)}
                            className={cn(
                              "w-10 h-10 rounded-lg overflow-hidden border flex items-center justify-center flex-shrink-0 transition-colors",
                              c.fotoUrl
                                ? "border-violet-500/40 hover:border-violet-400 bg-muted/20"
                                : "border-dashed border-border hover:border-violet-500/50 bg-muted/20 hover:bg-violet-500/5"
                            )}
                            title={c.fotoUrl ? "Ver/alterar foto" : "Adicionar foto"}
                          >
                            {c.fotoUrl ? (
                              <img
                                src={c.fotoUrl}
                                alt={c.modelo}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Camera className="w-4 h-4 text-muted-foreground/50" />
                            )}
                          </button>
                        </div>
                        <div className="font-medium text-sm text-foreground truncate min-w-0">{c.modelo}</div>
                        <div className="text-xs text-muted-foreground font-mono truncate">{c.codigo ?? "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.observacao ?? "—"}</div>
                        <div className="text-xs text-emerald-400 text-right">
                          {c.custo ? `R$ ${Number(c.custo).toFixed(2)}` : "—"}
                        </div>
                        <div className="flex justify-end gap-1 items-center">
                          <button
                            onClick={() => setProductsTarget(c)}
                            className="p-1.5 rounded text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                            title="Ver produtos que usam este componente"
                          >
                            <Package className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEdit(c)}
                            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(c)}
                            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* ─── Barra flutuante de exclusão em massa ─────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-destructive/40 bg-card shadow-2xl px-5 py-3 animate-in slide-in-from-bottom-4 duration-200">
          <CheckSquare2 className="w-4 h-4 text-destructive" />
          <span className="text-sm font-medium text-foreground">
            <strong className="text-destructive">{selectedIds.size}</strong> componente(s) selecionado(s)
          </span>
          <div className="w-px h-5 bg-border mx-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            className="h-7 text-xs"
          >
            Limpar seleção
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-destructive hover:bg-destructive/90 gap-1.5"
            onClick={() => setDeleteManyConfirm1(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Excluir selecionados
          </Button>
        </div>
      )}

      {/* ─── Confirmação dupla de exclusão em massa ────────────────────────────── */}
      {/* Primeiro confirm */}
      <AlertDialog open={deleteManyConfirm1} onOpenChange={(o) => { if (!o) setDeleteManyConfirm1(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} componente(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir <strong>{selectedIds.size} componente(s)</strong> da lista.
              Os produtos que já utilizam esses componentes não serão afetados, mas esta ação
              <strong className="text-destructive"> não pode ser desfeita</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteManyConfirm1(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { setDeleteManyConfirm1(false); setDeleteManyConfirm2(true); }}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Segundo confirm (confirmação final) */}
      <AlertDialog open={deleteManyConfirm2} onOpenChange={(o) => { if (!o) setDeleteManyConfirm2(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Confirmação final</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é <strong>irreversível</strong>. Confirme para excluir permanentemente{" "}
              <strong>{selectedIds.size} componente(s)</strong> do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteManyConfirm2(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteManyMut.isPending}
              onClick={() => deleteManyMut.mutate({ ids: Array.from(selectedIds) })}
            >
              {deleteManyMut.isPending ? "Excluindo..." : `Excluir ${selectedIds.size} componente(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>




      {/* ─── Foto Modal ─────────────────────────────────────────────────────────── */}
      <Dialog open={!!fotoTarget} onOpenChange={(o) => { if (!o) setFotoTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-violet-400" />
              Foto do Componente
            </DialogTitle>
          </DialogHeader>
          {fotoTarget && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/30 border border-border px-4 py-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{COMPONENT_TYPES.find((t) => t.value === fotoTarget.tipo)?.label ?? fotoTarget.tipo}</p>
                <p className="text-sm font-medium text-foreground">{fotoTarget.modelo}</p>
              </div>

              {/* Preview ou placeholder */}
              <div
                className={cn(
                  "relative rounded-xl border-2 border-dashed overflow-hidden flex items-center justify-center bg-muted/20 transition-colors h-52",
                  fotoTarget.fotoUrl ? "border-violet-500/40" : "border-border hover:border-violet-500/40 cursor-pointer"
                )}
                onClick={() => !fotoTarget.fotoUrl && fotoInputRef.current?.click()}
              >
                {fotoTarget.fotoUrl ? (
                  <img
                    src={fotoTarget.fotoUrl}
                    alt={fotoTarget.modelo}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Camera className="w-10 h-10" />
                    <p className="text-sm">Clique para adicionar foto</p>
                    <p className="text-xs">JPEG, PNG ou WEBP — máx. 10MB</p>
                  </div>
                )}
                {fotoUploading && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-violet-400" />
                  </div>
                )}
              </div>

              {/* Input oculto */}
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFotoUpload(f);
                  e.target.value = "";
                }}
              />

              {/* Ações */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => fotoInputRef.current?.click()}
                  disabled={fotoUploading}
                >
                  <Upload className="w-4 h-4" />
                  {fotoTarget.fotoUrl ? "Trocar foto" : "Enviar foto"}
                </Button>
                {fotoTarget.fotoUrl && (
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={handleFotoRemove}
                    disabled={fotoUploading}
                  >
                    <XIcon className="w-4 h-4" />
                    Remover
                  </Button>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFotoTarget(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Ver Produtos Modal ─────────────────────────────────────────────────── */}
      <Dialog open={!!productsTarget} onOpenChange={(o) => !o && setProductsTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-400" />
              Produtos que usam este componente
            </DialogTitle>
          </DialogHeader>
          {productsTarget && (
            <div className="space-y-3 py-1">
              <div className="rounded-lg bg-muted/30 border border-border px-4 py-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{tipoLabel(productsTarget.tipo)}</p>
                <p className="text-sm font-medium text-foreground">{productsTarget.modelo}</p>
              </div>

              {loadingProducts ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Carregando produtos...</div>
              ) : productsUsing.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum produto utiliza este componente.
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-foreground">{productsUsing.length}</strong> produto(s) utilizam este componente
                  </p>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-muted/30 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      <div className="col-span-5">Produto</div>
                      <div className="col-span-4">SKU</div>
                      <div className="col-span-3">Família</div>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
                      {productsUsing.map((p) => (
                        <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-muted/10 transition-colors">
                          <div className="col-span-5 text-sm text-foreground truncate" title={p.produto}>{p.produto}</div>
                          <div className="col-span-4 text-xs text-muted-foreground font-mono truncate">{p.sku}</div>
                          <div className="col-span-3 text-xs text-muted-foreground truncate">{p.familia}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductsTarget(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Create/Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Editar Componente" : "Novo Componente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Tipo */}
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => setForm((p) => ({ ...p, tipo: v as ComponentType, modelo: "" }))}
                disabled={!!editTarget}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {COMPONENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Modelo com autocomplete */}
            <div className="space-y-1.5">
              <Label>Modelo *</Label>
              <ModeloAutocomplete
                value={form.modelo}
                tipo={form.tipo}
                onChange={(v) => setForm((p) => ({ ...p, modelo: v }))}
                placeholder="Ex: PHILIPS CERTADRIVE 20W 500MA"
                disabled={!form.tipo}
              />
            </div>

            {/* Código */}
            <div className="space-y-1.5">
              <Label>Código <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value.toUpperCase() }))}
                placeholder="Ex: 929001905506"
                className={codigoEmUso ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {codigoEmUso && (
                <p className="text-xs text-destructive mt-1">
                  ⚠ Código já em uso por: <strong>{codigoConflito?.modelo}</strong>
                </p>
              )}
            </div>

            {/* Observação */}
            <div className="space-y-1.5">
              <Label>Observação <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                value={form.observacao}
                onChange={(e) => setForm((p) => ({ ...p, observacao: e.target.value }))}
                placeholder="Ex: Compatível com módulos 500mA"
              />
            </div>

            {/* Custo */}
            <div className="space-y-1.5">
              <Label>Custo (R$) <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-8"
                  value={form.custo}
                  onChange={(e) => setForm((p) => ({ ...p, custo: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Foto */}
            <div className="space-y-1.5">
              <Label>Foto <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              {form.fotoUrl ? (
                <div className="flex items-start gap-3">
                  <img
                    src={form.fotoUrl}
                    alt="Foto do componente"
                    className="w-24 h-24 object-contain rounded-lg border border-border bg-muted/30"
                  />
                  <div className="flex flex-col gap-2 mt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => formFotoInputRef.current?.click()}
                      disabled={formFotoUploading}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Trocar foto
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={handleFormFotoRemove}
                      disabled={formFotoUploading}
                    >
                      <XIcon className="w-3.5 h-3.5" />
                      Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => formFotoInputRef.current?.click()}
                  disabled={formFotoUploading}
                  className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border hover:border-violet-500/50 bg-muted/20 hover:bg-violet-500/5 transition-colors py-6 cursor-pointer disabled:opacity-50"
                >
                  {formFotoUploading ? (
                    <span className="text-sm text-muted-foreground">Enviando...</span>
                  ) : (
                    <>
                      <Camera className="w-6 h-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Clique para adicionar foto</span>
                    </>
                  )}
                </button>
              )}
              <input
                ref={formFotoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFormFotoUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending || codigoEmUso}>
              {createMut.isPending || updateMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm ──────────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir componente?</AlertDialogTitle>
            <AlertDialogDescription>
              O componente <strong>{deleteTarget?.modelo}</strong> será removido da lista. Os produtos que já utilizam este componente não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate({ id: deleteTarget.id })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Bulk Replace Modal ───────────────────────────────────────────────── */}
      <BulkReplaceModal
        open={showBulk}
        onClose={() => setShowBulk(false)}
        families={families}
        onSuccess={() => utils.components.list.invalidate()}
      />

      {/* ─── Import Excel Modal ──────────────────────────────────────────────── */}
      <ImportExcelModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onSuccess={() => utils.components.list.invalidate()}
      />
    </>
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
      const res = await fetch("/api/components/import-excel", {
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
        toast.success(`${data.inserted} componente(s) importado(s) com sucesso!`);
        onSuccess();
      } else {
        toast.warning("Nenhum componente novo foi inserido.");
      }
    } catch (err) {
      toast.error("Erro de rede ao importar: " + String(err));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    window.open("/api/components/template", "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            Importar Componentes em Massa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Template download */}
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Planilha Modelo</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Baixe o modelo com as colunas corretas e tipos válidos
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
                  <span>{result.inserted} componente(s) adicionado(s) com sucesso!</span>
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
                  <Upload className="w-4 h-4" />
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
