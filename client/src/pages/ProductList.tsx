import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
} from "lucide-react";
import ProductForm from "./ProductForm";

const CATEGORIAS = ["PERFIS", "DOWNLIGHTS", "PAINÉIS", "SPOTS", "ARANDELAS", "ÁREA EXTERNA", "BALIZADORES", "DECORATIVAS"];
const INSTALACOES = ["EMBUTIR", "SOBREPOR", "PENDENTE", "ARANDELA", "NO FRAME"];
const PAGE_SIZE = 20;

export default function ProductList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("_all");
  const [filterInstalacao, setFilterInstalacao] = useState("_all");
  const [page, setPage] = useState(0);
  const [editId, setEditId] = useState<number | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const queryInput = {
    search: search || undefined,
    categoria: filterCategoria !== "_all" ? filterCategoria : undefined,
    instalacao: filterInstalacao !== "_all" ? filterInstalacao : undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const { data, isLoading, refetch } = trpc.products.list.useQuery(queryInput, {
    keepPreviousData: true,
  } as any);

  const { data: countData } = trpc.products.count.useQuery();

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
        toast.success(`${data.inserted} produtos importados com sucesso!`);
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
    setPage(0);
  };

  const hasFilters = search || filterCategoria !== "_all" || filterInstalacao !== "_all";

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
          {/* Import */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => importRef.current?.click()}
            disabled={importing}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 text-xs font-semibold tracking-wider"
          >
            {importing ? (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5 mr-1.5" />
            )}
            IMPORTAR EXCEL
          </Button>
          <input
            ref={importRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }}
          />

          {/* Export */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 text-xs font-semibold tracking-wider"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            EXPORTAR EXCEL
          </Button>

          {/* New Product */}
          <Button
            size="sm"
            onClick={() => navigate("/cadastrar")}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold tracking-wider btn-glow"
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
            NOVO PRODUTO
          </Button>
        </div>
      </div>

      {/* ─── Filters ─────────────────────────────────────────────────── */}
      <div className="alfalux-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="input-dark pl-9"
              placeholder="BUSCAR POR PRODUTO, SKU, FAMÍLIA..."
              value={search}
              onChange={(e) => handleSearch(e.target.value.toUpperCase())}
            />
          </div>

          {/* Categoria filter */}
          <Select value={filterCategoria} onValueChange={(v) => { setFilterCategoria(v); setPage(0); }}>
            <SelectTrigger className="input-dark w-full sm:w-44">
              <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="CATEGORIA" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">TODAS CATEGORIAS</SelectItem>
              {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Instalação filter */}
          <Select value={filterInstalacao} onValueChange={(v) => { setFilterInstalacao(v); setPage(0); }}>
            <SelectTrigger className="input-dark w-full sm:w-44">
              <SelectValue placeholder="INSTALAÇÃO" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">TODAS INSTALAÇÕES</SelectItem>
              {INSTALACOES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Clear filters */}
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              LIMPAR
            </Button>
          )}
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
            <span className="text-xs text-muted-foreground ml-auto">{total} resultado(s)</span>
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
            {!hasFilters && (
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
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground tracking-wider">PRODUTO</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground tracking-wider hidden md:table-cell">SKU</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground tracking-wider hidden lg:table-cell">FAMÍLIA</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground tracking-wider hidden xl:table-cell">INSTALAÇÃO</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground tracking-wider hidden xl:table-cell">CATEGORIA</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground tracking-wider hidden lg:table-cell">DRIVERS</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground tracking-wider">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {items.map((product, idx) => {
                  const temps = (() => {
                    try { return JSON.parse(product.temperaturasCor || "[]"); }
                    catch { return []; }
                  })();

                  return (
                    <tr
                      key={product.id}
                      className={cn(
                        "border-b border-border/30 table-row-hover transition-colors",
                        idx % 2 === 0 ? "bg-transparent" : "bg-muted/5"
                      )}
                    >
                      {/* Produto */}
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          {product.fotoUrl ? (
                            <img src={product.fotoUrl} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-border/40" />
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
                                  {t}K
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
                          <span className="text-[10px] text-green-400/80 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400/60 inline-block" />
                            ON/OFF
                          </span>
                          {product.driverDim110v && (
                            <span className="text-[10px] text-blue-400/80 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 inline-block" />
                              DIM 1-10V
                            </span>
                          )}
                          {product.driverDimDali && (
                            <span className="text-[10px] text-purple-400/80 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400/60 inline-block" />
                              DALI
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setViewId(product.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditId(product.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteId(product.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {/* ─── Edit Modal ───────────────────────────────────────────────── */}
      <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-background border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground tracking-wider">EDITAR PRODUTO</DialogTitle>
          </DialogHeader>
          {editId && (
            <ProductForm
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

  const temps = (() => {
    try { return JSON.parse(product.temperaturasCor || "[]"); }
    catch { return []; }
  })();

  const Row = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex gap-3 py-2 border-b border-border/30 last:border-0">
      <span className="text-[11px] font-semibold text-muted-foreground tracking-wider w-40 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground flex-1">{value || "—"}</span>
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {product.fotoUrl && (
        <div className="flex justify-center">
          <img src={product.fotoUrl} alt={product.produto} className="max-h-48 rounded-xl border border-border/40 object-contain" />
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
              <span className="block text-[10px] text-primary/80 mt-0.5">R$ {Number((product as any).custoDriverOnoff220).toFixed(2).replace(".", ",")}</span>
            )}
          </div>
        </div>
        {/* ON/OFF BIVOLT */}
        <div className="flex items-start justify-between py-1.5 border-b border-border/30 last:border-0">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">ON/OFF BIVOLT</span>
          <div className="text-right">
            <span className="text-xs font-medium text-foreground">{product.driverOnoffBivolt || "—"}</span>
            {(product as any).custoDriverOnoffBivolt && (
              <span className="block text-[10px] text-primary/80 mt-0.5">R$ {Number((product as any).custoDriverOnoffBivolt).toFixed(2).replace(".", ",")}</span>
            )}
          </div>
        </div>
        {/* DIM 1-10V */}
        {product.driverDim110v && (
          <div className="flex items-start justify-between py-1.5 border-b border-border/30 last:border-0">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">DIM 1-10V</span>
            <div className="text-right">
              <span className="text-xs font-medium text-foreground">{product.driverDim110v}</span>
              {(product as any).custoDriverDim110v && (
                <span className="block text-[10px] text-primary/80 mt-0.5">R$ {Number((product as any).custoDriverDim110v).toFixed(2).replace(".", ",")}</span>
              )}
            </div>
          </div>
        )}
        {/* DIM DALI */}
        {product.driverDimDali && (
          <div className="flex items-start justify-between py-1.5 last:border-0">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">DIM DALI</span>
            <div className="text-right">
              <span className="text-xs font-medium text-foreground">{product.driverDimDali}</span>
              {(product as any).custoDriverDimDali && (
                <span className="block text-[10px] text-primary/80 mt-0.5">R$ {Number((product as any).custoDriverDimDali).toFixed(2).replace(".", ",")}</span>
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
              {t}K
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
