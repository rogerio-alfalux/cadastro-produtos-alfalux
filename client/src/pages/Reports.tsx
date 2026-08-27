import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Filter, Layers, Package, ReceiptText, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { REPORT_SECTION_KEYS, REPORT_SECTION_LABELS, type ReportSection } from "@shared/reports";

const currency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export default function ReportsPage() {
  const [filters, setFilters] = useState({ search: "", categoria: "", instalacao: "", familia: "", potencia: "", apenasInativos: false });
  const [sections, setSections] = useState<ReportSection[]>([...REPORT_SECTION_KEYS]);
  const queryInput = useMemo(() => ({
    ...filters,
    search: filters.search || undefined,
    categoria: filters.categoria || undefined,
    instalacao: filters.instalacao || undefined,
    familia: filters.familia || undefined,
    potencia: filters.potencia || undefined,
  }), [filters]);
  const optionsInput = useMemo(() => ({
    familia: filters.familia || undefined,
    categoria: filters.categoria || undefined,
    instalacao: filters.instalacao || undefined,
    potencia: filters.potencia || undefined,
  }), [filters.familia, filters.categoria, filters.instalacao, filters.potencia]);
  const { data: options } = trpc.reports.filterOptions.useQuery(optionsInput);
  const { data, isFetching } = trpc.reports.summary.useQuery(queryInput);
  useEffect(() => {
    if (!options) return;
    setFilters((current) => {
      const next = { ...current };
      if (next.familia && !options.familias.includes(next.familia)) next.familia = "";
      if (next.categoria && !options.categorias.includes(next.categoria)) next.categoria = "";
      if (next.instalacao && !options.instalacoes.includes(next.instalacao)) next.instalacao = "";
      if (next.potencia && !options.potencias.includes(next.potencia)) next.potencia = "";
      return next.familia === current.familia && next.categoria === current.categoria && next.instalacao === current.instalacao && next.potencia === current.potencia ? current : next;
    });
  }, [options]);
  const toggleSection = (section: ReportSection) => setSections((current) => current.includes(section) ? current.filter((item) => item !== section) : [...current, section]);
  const downloadReport = () => {
    const params = new URLSearchParams();
    Object.entries(queryInput).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && value !== false) params.set(key, String(value));
    });
    params.set("sections", sections.join(","));
    window.location.assign(`/api/products/reports-excel?${params.toString()}`);
  };
  const metrics = data?.metrics;

  return <div className="space-y-6 pb-10">
    <section className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="flex items-center gap-2 text-primary"><FileSpreadsheet className="h-5 w-5" /><span className="text-xs font-bold tracking-[0.14em]">GESTÃO EXECUTIVA</span></div><h1 className="mt-2 text-2xl font-extrabold tracking-tight">Relatórios gerenciais</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Cruze o portfólio, custos ON/OFF 220V, markups e preços em uma visão filtrável; exporte apenas as seções necessárias para cada análise.</p></div>
      <Button onClick={downloadReport} disabled={!data || sections.length === 0} className="gap-2"><Download className="h-4 w-4" />Exportar Excel com fórmulas</Button>
    </section>

    <section className="rounded-xl border bg-card p-4 shadow-sm"><div className="mb-4 flex items-center gap-2"><Filter className="h-4 w-4 text-primary" /><h2 className="font-semibold">Escopo do relatório</h2>{isFetching && <span className="text-xs text-muted-foreground">Atualizando…</span>}</div><p className="mb-4 text-xs text-muted-foreground">As opções são baseadas no cadastro real e se atualizam conforme os demais filtros selecionados.</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><div><Label>Produto ou SKU</Label><Input className="mt-1" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Buscar" /></div><div><Label>Família</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters.familia} onChange={(event) => setFilters({ ...filters, familia: event.target.value })}><option value="">Todas</option>{options?.familias.map((family) => <option key={family} value={family}>{family}</option>)}</select></div><div><Label>Categoria</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters.categoria} onChange={(event) => setFilters({ ...filters, categoria: event.target.value })}><option value="">Todas</option>{options?.categorias.map((category) => <option key={category} value={category}>{category}</option>)}</select></div><div><Label>Instalação</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters.instalacao} onChange={(event) => setFilters({ ...filters, instalacao: event.target.value })}><option value="">Todas</option>{options?.instalacoes.map((installation) => <option key={installation} value={installation}>{installation}</option>)}</select></div><div><Label>Potência</Label><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={filters.potencia} onChange={(event) => setFilters({ ...filters, potencia: event.target.value })}><option value="">Todas</option>{options?.potencias.map((power) => <option key={power} value={power}>{power.replace("-", " ")}</option>)}</select></div><label className="mt-6 flex h-10 items-center gap-2 rounded-md border px-3 text-sm"><input type="checkbox" checked={filters.apenasInativos} onChange={(event) => setFilters({ ...filters, apenasInativos: event.target.checked })} />Somente inativos</label></div></section>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{[
      [Package, "Produtos", String(metrics?.totalProducts ?? 0)], [TrendingUp, "Ativos", String(metrics?.activeProducts ?? 0)], [Layers, "Famílias", String(metrics?.families ?? 0)], [ReceiptText, "Com custo", String(metrics?.productsWithCost ?? 0)], [ReceiptText, "Custo total", currency(metrics?.totalCost ?? 0)], [ReceiptText, "Custo médio", currency(metrics?.averageCost ?? 0)],
    ].map(([Icon, label, value]) => { const MetricIcon = Icon as typeof Package; return <div key={label as string} className="rounded-xl border bg-card p-4"><MetricIcon className="h-4 w-4 text-primary" /><p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label as string}</p><p className="mt-1 text-xl font-bold">{value as string}</p></div>; })}</section>

    <section className="rounded-xl border bg-card p-4 shadow-sm"><h2 className="font-semibold">Conteúdo da planilha</h2><p className="mt-1 text-sm text-muted-foreground">A aba Produtos inclui as colunas selecionadas e cálculos de custo total e preço sugerido a partir dos markups cadastrados.</p><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{REPORT_SECTION_KEYS.map((section) => <label key={section} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/30"><input type="checkbox" className="h-4 w-4 accent-primary" checked={sections.includes(section)} onChange={() => toggleSection(section)} /><span>{REPORT_SECTION_LABELS[section]}</span></label>)}</div></section>

    <section className="overflow-hidden rounded-xl border bg-card shadow-sm"><div className="border-b px-4 py-3"><h2 className="font-semibold">Prévia dos produtos</h2><p className="text-sm text-muted-foreground">Primeiros registros do escopo selecionado. A exportação contém todos os resultados filtrados.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[840px] text-sm"><thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3">Família</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3 text-right">Custo ON/OFF 220V</th><th className="px-4 py-3 text-right">Markup padrão</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{data?.items.map((item) => <tr key={item.id} className="border-t"><td className="max-w-[280px] px-4 py-3 font-medium">{item.produto}</td><td className="px-4 py-3 text-muted-foreground">{item.sku}</td><td className="px-4 py-3">{item.familia}</td><td className="px-4 py-3">{item.categoria}</td><td className="px-4 py-3 text-right">{item.total === null ? "—" : currency(item.total)}</td><td className="px-4 py-3 text-right">{item.markupPadrao === null ? "—" : `${item.markupPadrao}x`}</td><td className="px-4 py-3"><span className={item.ativo === false ? "text-amber-600" : "text-emerald-600"}>{item.ativo === false ? "Inativo" : "Ativo"}</span></td></tr>)}{!isFetching && !data?.items.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Nenhum produto encontrado com os filtros selecionados.</td></tr>}</tbody></table></div></section>
  </div>;
}
