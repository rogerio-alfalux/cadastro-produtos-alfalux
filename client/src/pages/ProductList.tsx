import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { can } from "@shared/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  PlusCircle,
  Download,
  Upload,
  Edit2,
  Trash2,
  Eye,
  Filter,
  X,
  Package,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  RefreshCw,
  AlertTriangle,
  Zap,
  Copy,
  FileText,
  DollarSign,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import ProductForm from "./ProductForm";
import { useAuth } from "@/_core/hooks/useAuth";

const PAGE_SIZE = 20;
const CCT_MODULE_FIELDS = {
  "2700": "moduloLed2700",
  "3000": "moduloLed3000",
  "3500": "moduloLed3500",
  "4000": "moduloLed4000",
  "5000": "moduloLed5000",
} as const;

function hasModuleValue(value: unknown) {
  return typeof value === "string" && value.trim() !== "" && value.trim().toUpperCase() !== "NÃO APLICÁVEL";
}

function getExtraCcts(product: Record<string, unknown>): string[] {
  try {
    const raw = product.moduloLedExtra;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const cct = String(row.cct ?? "").replace(/\D/g, "");
      return hasModuleValue(row.modelo) && /^\d{4,5}$/.test(cct) ? [cct] : [];
    });
  } catch {
    return [];
  }
}

type ProductDocumentBadge = { url: string; nome: string };
type ProductDocumentBadges = Partial<Record<"datasheet" | "fotometria" | "desenhoTecnico", ProductDocumentBadge>>;

function getProductDocuments(raw: unknown): ProductDocumentBadges {
  if (!raw) return {};
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: ProductDocumentBadges = {};
    for (const tipo of ["datasheet", "fotometria", "desenhoTecnico"] as const) {
      const value = (parsed as Record<string, unknown>)[tipo];
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const document = value as Record<string, unknown>;
      const url = String(document.url ?? "").trim();
      const nome = String(document.nome ?? "").trim();
      if (url) result[tipo] = { url, nome };
    }
    return result;
  } catch {
    return {};
  }
}

function getAvailableCcts(product: unknown): string[] {
  const item = product as Record<string, unknown>;
  let selectedCcts: string[] = [];
  try {
    const parsed = JSON.parse(String(item.temperaturasCor ?? "[]"));
    selectedCcts = Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }

  const extraCcts = getExtraCcts(item);
  const extraCctsSet = new Set(extraCcts);
  const cctsDoProduto = Array.from(new Set([...selectedCcts, ...extraCcts]));
  const hasSpecificCctModule = Object.values(CCT_MODULE_FIELDS).some((field) => hasModuleValue(item[field])) || extraCcts.length > 0;
  if (hasSpecificCctModule) {
    return cctsDoProduto.filter((cct) =>
      cct === "RGBW"
        ? hasModuleValue(item.moduloLedRgbw)
        : extraCctsSet.has(cct) || hasModuleValue(item[CCT_MODULE_FIELDS[cct as keyof typeof CCT_MODULE_FIELDS]])
    );
  }

  return hasModuleValue(item.moduloLed) ? selectedCcts : [];
}

export default function ProductList() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canUse = (permission: Parameters<typeof can>[1]) => user ? can(user.role, permission, user.permissionOverrides) : false;
  const canManageEntities = canUse("manageEntities");
  const canViewCosts = canUse("viewCosts") || canUse("editCosts");
  const canEditCosts = canUse("editCosts");
  const canManageDocuments = canUse("manageDocuments");
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("_all");
  const [filterInstalacao, setFilterInstalacao] = useState("_all");
  const [filterFamilia, setFilterFamilia] = useState("_all");
  const [filterPotencia, setFilterPotencia] = useState("_all");
  const [filterAtivo, setFilterAtivo] = useState<"_all" | "inativos">("_all");
  const [page, setPage] = useState(0);
  const [editId, setEditId] = useState<number | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [duplicarId, setDuplicarId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const queryInput = useMemo(() => ({
    search: search || undefined,
    categoria: filterCategoria !== "_all" ? filterCategoria : undefined,
    instalacao: filterInstalacao !== "_all" ? filterInstalacao : undefined,
    familia: filterFamilia !== "_all" ? filterFamilia : undefined,
    potencia: filterPotencia !== "_all" ? filterPotencia : undefined,
    apenasInativos: filterAtivo === "inativos" ? true : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [search, filterCategoria, filterInstalacao, filterFamilia, filterPotencia, filterAtivo, page]);

  const filterOptionsInput = useMemo(() => ({
    categoria: filterCategoria !== "_all" ? filterCategoria : undefined,
    instalacao: filterInstalacao !== "_all" ? filterInstalacao : undefined,
    familia: filterFamilia !== "_all" ? filterFamilia : undefined,
    potencia: filterPotencia !== "_all" ? filterPotencia : undefined,
  }), [filterCategoria, filterInstalacao, filterFamilia, filterPotencia]);

  const { data, isLoading, refetch } = trpc.products.list.useQuery(queryInput, {
    keepPreviousData: true,
  } as any);

  const { data: countData } = trpc.products.count.useQuery();
  const { data: filterOptions } = trpc.products.filterOptions.useQuery(filterOptionsInput);
  const categorias = filterOptions?.categorias ?? [];
  const instalacoes = filterOptions?.instalacoes ?? [];
  const familias = filterOptions?.familias ?? [];
  const potencias = filterOptions?.potencias ?? [];

  useEffect(() => {
    if (!filterOptions) return;
    let changed = false;
    if (filterCategoria !== "_all" && !categorias.includes(filterCategoria)) {
      setFilterCategoria("_all");
      changed = true;
    }
    if (filterInstalacao !== "_all" && !instalacoes.includes(filterInstalacao)) {
      setFilterInstalacao("_all");
      changed = true;
    }
    if (filterFamilia !== "_all" && !familias.includes(filterFamilia)) {
      setFilterFamilia("_all");
      changed = true;
    }
    if (filterPotencia !== "_all" && !potencias.includes(filterPotencia)) {
      setFilterPotencia("_all");
      changed = true;
    }
    if (changed) setPage(0);
  }, [filterOptions, categorias, instalacoes, familias, potencias, filterCategoria, filterInstalacao, filterFamilia, filterPotencia]);

  const utils = trpc.useUtils();
  const deleteMutation = trpc.products.delete.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      utils.products.count.invalidate();
      setDeleteId(null);
      toast.success("Produto removido com sucesso");
    },
    onError: (err) => toast.error("Erro ao remover: " + err.message),
  });

  const toggleAtivoMutation = trpc.products.toggleAtivo.useMutation({
    onMutate: async ({ id, ativo }) => {
      // Optimistic update
      await utils.products.list.cancel();
      const prev = utils.products.list.getData(queryInput);
      utils.products.list.setData(queryInput, (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((p) => p.id === id ? { ...p, ativo } : p),
        };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.products.list.setData(queryInput, ctx.prev);
      toast.error("Erro ao alterar status do produto");
    },
    onSuccess: (_data, vars) => {
      utils.products.list.invalidate();
      toast.success(vars.ativo ? "Produto ativado" : "Produto desativado");
    },
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(0);
  };

  const handleExport = async () => {
    try {
      const a = document.createElement("a");
      a.href = "/api/products/export-excel";
      a.download = "cadastro-produtos-alfalux.xlsx";
      a.click();
      toast.success("Exportação iniciada!");
    } catch {
      toast.error("Erro ao exportar");
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/products/import-excel", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        const msg = data.skipped > 0
          ? `${data.inserted} produtos importados. ${data.skipped} já existiam e foram ignorados.`
          : `${data.inserted} produtos importados com sucesso!`;
        if (data.skipped > 0) toast.info(msg); else toast.success(msg);
        utils.products.list.invalidate();
        utils.products.count.invalidate();
      } else {
        toast.error(data.error || "Erro ao importar");
      }
    } catch {
      toast.error("Erro ao importar arquivo");
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  const clearFilters = () => {
    setSearch("");
    setFilterCategoria("_all");
    setFilterInstalacao("_all");
    setFilterFamilia("_all");
    setFilterPotencia("_all");
    setFilterAtivo("_all");
    setPage(0);
  };

  const showPotenciaFilter = filterCategoria === "PERFIS" || (filterCategoria === "_all" && categorias.length === 1 && categorias[0] === "PERFIS");
  const hasFilters = search || filterCategoria !== "_all" || filterInstalacao !== "_all" || filterFamilia !== "_all" || filterPotencia !== "_all" || filterAtivo !== "_all";

  return (
    <div className="animate-fade-in">
      {/* ─── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <Package className="w-6 h-6 text-primary" />
            BASE DE PRODUTOS
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {countData?.count ?? 0} produtos cadastrados no sistema
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canManageEntities && <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => importRef.current?.click()}
              disabled={importing}
              className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 text-xs font-semibold tracking-wider"
            >
              {importing ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
              IMPORTAR EXCEL
            </Button>
            <input ref={importRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
          </>}

          {canViewCosts && <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 text-xs font-semibold tracking-wider"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            EXPORTAR EXCEL
          </Button>}

          {canManageEntities && <Button
            size="sm"
            onClick={() => navigate("/cadastrar")}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold tracking-wider btn-glow"
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
            NOVO PRODUTO
          </Button>}
        </div>
      </div>

      {/* ─── Filters ─────────────────────────────────────────────────── */}
      <div className="alfalux-card p-4 mb-6">
        <div className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
          showPotenciaFilter
            ? "lg:grid-cols-[minmax(0,1.25fr)_repeat(5,minmax(0,1fr))]"
            : "lg:grid-cols-[minmax(0,1.35fr)_repeat(4,minmax(0,1fr))]"
        )}>
          {/* Search */}
          <div className="relative min-w-0 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="input-dark pl-9"
              placeholder="BUSCAR POR PRODUTO, SKU, FAMÍLIA..."
              value={search}
              onChange={(e) => handleSearch(e.target.value.toUpperCase())}
            />
          </div>

          {/* Categoria filter */}
          <Select value={filterCategoria} onValueChange={(v) => {
            setFilterCategoria(v);
            if (v !== "PERFIS") setFilterPotencia("_all");
            setPage(0);
          }}>
            <SelectTrigger className="input-dark w-full min-w-0 text-xs">
              <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="CATEGORIA" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">TODAS CATEGORIAS</SelectItem>
              {categorias.map((categoria) => <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Instalação filter */}
          <Select value={filterInstalacao} onValueChange={(v) => { setFilterInstalacao(v); setPage(0); }}>
            <SelectTrigger className="input-dark w-full min-w-0 text-xs">
              <SelectValue placeholder="INSTALAÇÃO" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">TODAS INSTALAÇÕES</SelectItem>
              {instalacoes.map((instalacao) => <SelectItem key={instalacao} value={instalacao}>{instalacao}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Família filter */}
          <Select value={filterFamilia} onValueChange={(v) => { setFilterFamilia(v); setPage(0); }}>
            <SelectTrigger className="input-dark w-full min-w-0 text-xs">
              <SelectValue placeholder="FAMÍLIA" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">TODAS FAMÍLIAS</SelectItem>
              {familias.map((familia) => <SelectItem key={familia} value={familia}>{familia}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Potência filter */}
          {showPotenciaFilter && (
            <Select value={filterPotencia} onValueChange={(v) => { setFilterPotencia(v); setPage(0); }}>
              <SelectTrigger className="input-dark w-full min-w-0 text-xs">
                <Zap className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="POTÊNCIA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">TODAS POTÊNCIAS</SelectItem>
                {potencias.map((potencia) => <SelectItem key={potencia} value={potencia}>{potencia === "36W-SF" ? "36W — Stripflex" : potencia === "36W-SL" ? "36W — Stripline" : potencia}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {/* Status filter */}
          <Select value={filterAtivo} onValueChange={(v) => { setFilterAtivo(v as "_all" | "inativos"); setPage(0); }}>
            <SelectTrigger className="input-dark w-full min-w-0 text-xs">
              <SelectValue placeholder="STATUS" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">TODOS OS STATUS</SelectItem>
              <SelectItem value="inativos">SOMENTE DESATIVADOS</SelectItem>
            </SelectContent>
          </Select>

        </div>

        {hasFilters && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
            <span className="text-xs text-muted-foreground">Filtros ativos:</span>
            {search && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-md">
                Busca: {search}
              </span>
            )}
            {filterCategoria !== "_all" && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-md">
                {filterCategoria}
              </span>
            )}
            {filterInstalacao !== "_all" && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-md">
                {filterInstalacao}
              </span>
            )}
            {filterFamilia !== "_all" && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-md">
                Família: {filterFamilia}
              </span>
            )}
            {filterPotencia !== "_all" && (
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md">
                ⚡ {filterPotencia}
              </span>
            )}
            {filterAtivo === "inativos" && (
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-md">
                Desativados
              </span>
            )}
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{total} resultado(s)</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                LIMPAR
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Table ───────────────────────────────────────────────────── */}
      <div className="alfalux-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground tracking-wider">CARREGANDO...</span>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center">
              <Package className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-muted-foreground">NENHUM PRODUTO ENCONTRADO</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {hasFilters ? "Tente ajustar os filtros" : "Cadastre o primeiro produto"}
              </p>
            </div>
            {!hasFilters && canManageEntities && (
              <Button
                size="sm"
                onClick={() => navigate("/cadastrar")}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold tracking-wider mt-2"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                CADASTRAR PRODUTO
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20">
                  <th className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground tracking-wider" style={{minWidth: 220}}>PRODUTO</th>
                  <th className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground tracking-wider hidden md:table-cell" style={{width: 160}}>SKU</th>
                  <th className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground tracking-wider hidden lg:table-cell" style={{width: 130}}>FAMÍLIA</th>
                  <th className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground tracking-wider hidden xl:table-cell" style={{width: 110}}>INSTALAÇÃO</th>
                  <th className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground tracking-wider hidden xl:table-cell" style={{width: 120}}>CATEGORIA</th>
                  <th className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground tracking-wider hidden lg:table-cell" style={{width: 140}}>DRIVERS</th>
                  <th className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground tracking-wider hidden md:table-cell" style={{width: 125}}>DOCUMENTOS</th>
                  {canViewCosts && <th className="text-right px-3 py-3 text-[11px] font-semibold text-muted-foreground tracking-wider hidden lg:table-cell" style={{width: 90}}>CUSTO</th>}
                  <th className="text-right px-3 py-3 text-[11px] font-semibold text-muted-foreground tracking-wider" style={{width: 160}}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {items.map((product, idx) => {
                  const temps = getAvailableCcts(product);
                  const productDocuments = getProductDocuments((product as any).documentosVisualizacao ?? (product as any).documentos);
                  const isAtivo = (product as any).ativo !== false;
                  const productImageUrl = (product as any).fotoPublicUrl || product.fotoUrl;

                  return (
                    <tr
                      key={product.id}
                      className={cn(
                        "border-b border-border/30 table-row-hover transition-colors",
                        idx % 2 === 0 ? "bg-transparent" : "bg-muted/5",
                        !isAtivo && "opacity-50"
                      )}
                    >
                      {/* Produto */}
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          {productImageUrl ? (
                            <img src={productImageUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-border/40" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
                              <Zap className="w-4 h-4 text-muted-foreground/40" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-foreground leading-tight">{product.produto}</p>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {temps.map((t: string) => (
                                <span key={t} className="text-[10px] bg-muted/40 text-muted-foreground px-1.5 py-0.5 rounded">
                                  {t === "RGBW" ? t : `${t}K`}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* SKU */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded">
                          {product.sku}
                        </span>
                      </td>

                      {/* Família */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-xs font-semibold text-primary/80">{product.familia}</span>
                      </td>

                      {/* Instalação */}
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className="text-xs text-muted-foreground">{product.instalacao}</span>
                      </td>

                      {/* Categoria */}
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className="text-xs text-muted-foreground">{product.categoria || "—"}</span>
                      </td>

                      {/* Drivers */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex flex-col gap-0.5">
                          {product.semDriver || product.moduloLampada ? (
                            <span className="text-[10px] text-muted-foreground italic">—</span>
                          ) : (
                            <>
                              {(product.driverOnoff220 && product.driverOnoff220 !== 'NÃO APLICÁVEL') || (product.driverOnoffBivolt && product.driverOnoffBivolt !== 'NÃO APLICÁVEL') ? (
                                <span className="text-[10px] text-green-400/80 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-400/60 inline-block" />
                                  ON/OFF
                                </span>
                              ) : null}
                              {!product.driverDim110vNaoAplicavel && product.driverDim110v && product.driverDim110v !== 'NÃO APLICÁVEL' && (
                                <span className="text-[10px] text-blue-400/80 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 inline-block" />
                                  DIM 1-10V
                                </span>
                              )}
                              {!product.driverDimDaliNaoAplicavel && product.driverDimDali && product.driverDimDali !== 'NÃO APLICÁVEL' && (
                                <span className="text-[10px] text-purple-400/80 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400/60 inline-block" />
                                  DALI
                                </span>
                              )}
                              {!product.driverDimTriac110vNaoAplicavel && product.driverDimTriac110v && product.driverDimTriac110v !== 'NÃO APLICÁVEL' && (
                                <span className="text-[10px] text-orange-400/80 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400/60 inline-block" />
                                  TRIAC 110V
                                </span>
                              )}
                              {!product.driverDimTriac220vNaoAplicavel && product.driverDimTriac220v && product.driverDimTriac220v !== 'NÃO APLICÁVEL' && (
                                <span className="text-[10px] text-amber-400/80 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 inline-block" />
                                  TRIAC 220V
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      {/* Documentos */}
                      <td className="px-3 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 min-w-[104px]">
                          {([
                            { tipo: "datasheet", sigla: "DS", className: "border-cyan-500/35 bg-cyan-500/10 text-cyan-300" },
                            { tipo: "fotometria", sigla: "IES", className: "border-violet-500/35 bg-violet-500/10 text-violet-300" },
                            { tipo: "desenhoTecnico", sigla: "DT", className: "border-amber-500/35 bg-amber-500/10 text-amber-300" },
                          ] as const).map(({ tipo, sigla, className }) => {
                            const document = productDocuments[tipo];
                            return document ? (
                              <a
                                key={tipo}
                                href={document.url}
                                target="_blank"
                                rel="noreferrer"
                                title={document.nome || sigla}
                                className={cn("h-6 min-w-7 px-1.5 rounded border text-[9px] font-extrabold tracking-wide inline-flex items-center justify-center hover:brightness-125 transition", className)}
                              >
                                {sigla}
                              </a>
                            ) : null;
                          })}
                          {Object.keys(productDocuments).length === 0 && <span className="text-xs text-muted-foreground/50">—</span>}
                        </div>
                      </td>

                      {/* Custo */}
                      {canViewCosts && <td className="px-4 py-3 hidden lg:table-cell">
                        {(() => {
                          const custo =
                            parseFloat(product.custoCorpoOnoff220v as string) ||
                            parseFloat(product.custoCorpoOnoffBivolt as string) ||
                            parseFloat(product.custoCorpoDim110v as string) ||
                            parseFloat(product.custoCorpoDimDali as string) ||
                            parseFloat(product.custoCorpoDimTriac110v as string) ||
                            parseFloat(product.custoCorpoDimTriac220v as string) ||
                            0;
                          return custo > 0 ? (
                            <span className="text-xs font-semibold text-foreground/80 tabular-nums">
                              R$ {custo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/40">—</span>
                          );
                        })()}
                      </td>}

                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Checkbox ativo/inativo */}
                          {canManageEntities && <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center px-1">
                                  <Checkbox
                                    checked={isAtivo}
                                    onCheckedChange={(checked) => {
                                      toggleAtivoMutation.mutate({ id: product.id, ativo: !!checked });
                                    }}
                                    className={cn(
                                      "w-4 h-4 transition-colors",
                                      isAtivo
                                        ? "border-green-500 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                        : "border-red-500/60"
                                    )}
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                {isAtivo ? "Ativo — clique para desativar" : "Inativo — clique para ativar"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>}

                          <button
                            onClick={() => setViewId(product.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canManageEntities && <button
                            onClick={() => setDuplicarId(product.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors"
                            title="Duplicar produto"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>}
                          {canManageEntities && <button
                            onClick={() => setEditId(product.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>}
                          {canManageEntities && <button
                            onClick={() => setDeleteId(product.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>}
                          {canManageDocuments && !canManageEntities && <button
                            onClick={() => navigate(`/documentos/${product.id}`)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-cyan-300 hover:bg-cyan-400/10 transition-colors"
                            title="Gerenciar documentos"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>}
                          {canEditCosts && !canManageEntities && <button
                            onClick={() => navigate(`/custos/${product.id}`)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-300 hover:bg-amber-400/10 transition-colors"
                            title="Editar custos e markups"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                          </button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
            <span className="text-xs text-muted-foreground">
              Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-xs font-semibold transition-colors",
                      pageNum === page
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Duplicate Modal ──────────────────────────────────────────── */}
      <Dialog open={!!duplicarId} onOpenChange={(o) => !o && setDuplicarId(null)}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-cyan-400 tracking-wider flex items-center gap-2">
              <Copy className="w-4 h-4" />
              DUPLICAR PRODUTO
            </DialogTitle>
          </DialogHeader>
          {duplicarId && (
            <ProductForm
              key={duplicarId}
              duplicarDeId={duplicarId}
              onSuccess={() => setDuplicarId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Edit Modal ───────────────────────────────────────────────── */}
      <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground tracking-wider">EDITAR PRODUTO</DialogTitle>
          </DialogHeader>
          {editId && (
            <ProductForm
              key={editId}
              editId={editId}
              onSuccess={() => setEditId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ─── View Modal ───────────────────────────────────────────────── */}
      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground tracking-wider">DETALHES DO PRODUTO</DialogTitle>
          </DialogHeader>
          {viewId && <ProductDetail id={viewId} />}
          <DialogFooter className="mt-4 pt-4 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setDuplicarId(viewId); setViewId(null); }}
              className="border-cyan-500/40 text-cyan-400 hover:bg-cyan-400/10 hover:text-cyan-300 text-xs font-bold tracking-wider"
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              DUPLICAR ESTE PRODUTO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm ───────────────────────────────────────────── */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-md bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              CONFIRMAR EXCLUSÃO
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Esta ação não pode ser desfeita. O produto será removido permanentemente da base de dados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteId(null)} className="text-muted-foreground">
              CANCELAR
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              disabled={deleteMutation.isPending}
              className="font-bold tracking-wider"
            >
              {deleteMutation.isPending ? "REMOVENDO..." : "CONFIRMAR EXCLUSÃO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Product Detail Component ─────────────────────────────────────────────────

function ProductDetail({ id }: { id: number }) {
  const { data: product, isLoading } = trpc.products.getById.useQuery({ id });

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!product) return <p className="text-muted-foreground text-sm">Produto não encontrado</p>;

  const temps = getAvailableCcts(product);

  const Row = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex gap-3 py-2 border-b border-border/30 last:border-0">
      <span className="text-[11px] font-semibold text-muted-foreground tracking-wider w-40 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground flex-1">{value || "—"}</span>
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {(product.fotoPublicUrl || product.fotoUrl) && (
        <div className="flex justify-center">
          <img src={product.fotoPublicUrl || product.fotoUrl || undefined} alt={product.produto} className="max-h-48 rounded-xl border border-border/40 object-contain" />
        </div>
      )}

      <div className="alfalux-card p-4">
        <p className="section-header mb-3">IDENTIFICAÇÃO</p>
        <Row label="PRODUTO" value={product.produto} />
        <Row label="SKU" value={product.sku} />
        <Row label="FAMÍLIA" value={product.familia} />
        <Row label="CATEGORIA" value={product.categoria} />
        <Row label="INSTALAÇÃO" value={product.instalacao} />
      </div>

      <div className="alfalux-card p-4">
        <p className="section-header mb-3">COMPONENTES</p>
        <Row label="MÓDULO LED" value={product.moduloLed} />
        <Row label="ÓTICA" value={product.oticaNaoAplicavel ? "NÃO APLICÁVEL" : product.otica} />
        <Row label="HOLDER" value={product.holderNaoAplicavel ? "NÃO APLICÁVEL" : product.holder} />
        <Row label="DISSIPADOR" value={product.dissipadorNaoAplicavel ? "NÃO APLICÁVEL" : product.dissipador} />
      </div>

      <div className="alfalux-card p-4">
        <p className="section-header mb-3">DRIVERS</p>
        {/* ON/OFF 220Vac */}
        <div className="flex items-start justify-between py-1.5 border-b border-border/30 last:border-0">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">ON/OFF 220Vac</span>
          <div className="text-right">
            <span className="text-xs font-medium text-foreground">{product.driverOnoff220 || "—"}</span>
            {(product as any).custoDriverOnoff220 && (
              <span className="block text-[10px] text-primary/80 mt-0.5">Custo: R$ {Number((product as any).custoDriverOnoff220).toFixed(2).replace(".", ",")}</span>
            )}

          </div>
        </div>
        {/* ON/OFF BIVOLT */}
        {!product.driverOnoffBivoltNaoAplicavel && (
        <div className="flex items-start justify-between py-1.5 border-b border-border/30 last:border-0">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">ON/OFF BIVOLT</span>
          <div className="text-right">
            <span className="text-xs font-medium text-foreground">{product.driverOnoffBivolt || "—"}</span>
            {(product as any).custoDriverOnoffBivolt && (
              <span className="block text-[10px] text-primary/80 mt-0.5">Custo: R$ {Number((product as any).custoDriverOnoffBivolt).toFixed(2).replace(".", ",")}</span>
            )}

          </div>
        </div>
        )}
        {/* DIM 1-10V */}
        {!product.driverDim110vNaoAplicavel && product.driverDim110v && (
          <div className="flex items-start justify-between py-1.5 border-b border-border/30 last:border-0">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">DIM 1-10V</span>
            <div className="text-right">
              <span className="text-xs font-medium text-foreground">{product.driverDim110v}</span>
              {(product as any).custoDriverDim110v && (
                <span className="block text-[10px] text-primary/80 mt-0.5">Custo: R$ {Number((product as any).custoDriverDim110v).toFixed(2).replace(".", ",")}</span>
              )}

            </div>
          </div>
        )}
        {/* DIM DALI */}
        {!product.driverDimDaliNaoAplicavel && product.driverDimDali && (
          <div className="flex items-start justify-between py-1.5 last:border-0">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">DIM DALI</span>
            <div className="text-right">
              <span className="text-xs font-medium text-foreground">{product.driverDimDali}</span>
              {(product as any).custoDriverDimDali && (
                <span className="block text-[10px] text-primary/80 mt-0.5">Custo: R$ {Number((product as any).custoDriverDimDali).toFixed(2).replace(".", ",")}</span>
              )}

            </div>
          </div>
        )}
      </div>

      <div className="alfalux-card p-4">
        <p className="section-header mb-3">TEMPERATURAS DE COR</p>
        <div className="flex flex-wrap gap-2">
          {temps.map((t: string) => (
            <span key={t} className="text-xs bg-primary/20 text-primary px-3 py-1.5 rounded-lg font-semibold border border-primary/30">
              {t === "RGBW" ? t : `${t}K`}
            </span>
          ))}
        </div>
      </div>

      {product.custoLuminaria && (
        <div className="alfalux-card p-4">
          <p className="section-header mb-3">CUSTO DA LUMINÁRIA</p>
          <Row label="CUSTO DO CORPO" value={`R$ ${Number(product.custoLuminaria).toFixed(2).replace(".", ",")}`} />
        </div>
      )}
    </div>
  );
}
