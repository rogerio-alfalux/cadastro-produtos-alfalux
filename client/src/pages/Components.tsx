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
import { Plus, Pencil, Trash2, RefreshCw, Search, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

type ComponentType =
  | "DRIVER_ONOFF_220"
  | "DRIVER_ONOFF_BIVOLT"
  | "DRIVER_DIM_110V"
  | "DRIVER_DIM_DALI"
  | "OTICA"
  | "HOLDER"
  | "DISSIPADOR"
  | "MODULO_LED";

const COMPONENT_TYPES: { value: ComponentType; label: string }[] = [
  { value: "DRIVER_ONOFF_220", label: "Driver ON/OFF 220V" },
  { value: "DRIVER_ONOFF_BIVOLT", label: "Driver ON/OFF Bivolt" },
  { value: "DRIVER_DIM_110V", label: "Driver Dim 1-10V" },
  { value: "DRIVER_DIM_DALI", label: "Driver Dim DALI" },
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
}

interface FormState {
  tipo: ComponentType | "";
  modelo: string;
  codigo: string;
  observacao: string;
  custo: string;
}

const EMPTY_FORM: FormState = {
  tipo: "",
  modelo: "",
  codigo: "",
  observacao: "",
  custo: "",
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
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.tipo || !form.modelo.trim()) {
      toast.error("Tipo e Modelo são obrigatórios.");
      return;
    }
    if (editTarget) {
      updateMut.mutate({ id: editTarget.id, modelo: form.modelo, codigo: form.codigo, observacao: form.observacao, custo: form.custo });
    } else {
      createMut.mutate({ tipo: form.tipo as ComponentType, modelo: form.modelo, codigo: form.codigo, observacao: form.observacao, custo: form.custo });
    }
  };

  // ─── Delete dialog ────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<ComponentRow | null>(null);

  // ─── Bulk replace dialog ──────────────────────────────────────────────────
  const [showBulk, setShowBulk] = useState(false);

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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowBulk(true)} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Alteração em Massa
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
                    <div className="grid grid-cols-12 gap-3 px-5 py-2 bg-muted/20 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      <div className="col-span-5">Modelo</div>
                      <div className="col-span-2">Código</div>
                      <div className="col-span-3">Observação</div>
                      <div className="col-span-1 text-right">Custo</div>
                      <div className="col-span-1" />
                    </div>
                    {items.map((c) => (
                      <div
                        key={c.id}
                        className="grid grid-cols-12 gap-3 px-5 py-3 items-center hover:bg-muted/10 transition-colors"
                      >
                        <div className="col-span-5 font-medium text-sm text-foreground truncate">{c.modelo}</div>
                        <div className="col-span-2 text-xs text-muted-foreground font-mono truncate">{c.codigo ?? "—"}</div>
                        <div className="col-span-3 text-xs text-muted-foreground truncate">{c.observacao ?? "—"}</div>
                        <div className="col-span-1 text-xs text-emerald-400 text-right">
                          {c.custo ? `R$ ${Number(c.custo).toFixed(2)}` : "—"}
                        </div>
                        <div className="col-span-1 flex justify-end gap-1">
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
              />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
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
    </>
  );
}
