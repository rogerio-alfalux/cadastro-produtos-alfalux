import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, FileStack, Files, Search, UploadCloud } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type DocumentType = "datasheet" | "fotometria" | "desenhoTecnico";

const documentOptions: Array<{ type: DocumentType; label: string; badge: string }> = [
  { type: "datasheet", label: "Datasheet", badge: "DS" },
  { type: "fotometria", label: "Fotometria IES", badge: "IES" },
  { type: "desenhoTecnico", label: "Desenho Técnico", badge: "DT" },
];

const powers = ["18W", "26W", "36W-SF", "36W-SL"] as const;

export default function BulkDocumentsPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [targetFamily, setTargetFamily] = useState("");
  const [targetCategory, setTargetCategory] = useState("PERFIS");
  const [targetPower, setTargetPower] = useState("");
  const [productTerm, setProductTerm] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<DocumentType[]>(["datasheet", "fotometria"]);
  const [replaceExisting, setReplaceExisting] = useState(false);

  const { data: matchingProducts } = trpc.products.list.useQuery({ search: sourceSearch || undefined, limit: 30, offset: 0 }, { enabled: sourceSearch.trim().length >= 3 });
  const { data: families = [] } = trpc.bulkOps.families.useQuery();
  const input = useMemo(() => ({
    sourceProductId: sourceId ?? 0,
    familia: targetFamily,
    categoria: targetCategory === "_all" ? undefined : targetCategory,
    potencia: targetCategory === "PERFIS" && targetPower ? targetPower as (typeof powers)[number] : undefined,
    produtoContem: productTerm.trim() || undefined,
    tipos: selectedTypes,
    substituirExistentes: replaceExisting,
  }), [sourceId, targetFamily, targetCategory, targetPower, productTerm, selectedTypes, replaceExisting]);
  const preview = trpc.documentosEmMassa.preview.useQuery(input, { enabled: false, retry: false });
  const apply = trpc.documentosEmMassa.applyDocuments.useMutation({
    onSuccess: async (result) => {
      toast.success(`${result.updated} produto(s) atualizado(s) com documentos compartilhados.`);
      await Promise.all([utils.products.list.invalidate(), preview.refetch()]);
    },
    onError: (error) => toast.error(error.message),
  });

  const canPreview = Boolean(sourceId && targetFamily && selectedTypes.length);
  const chooseSource = (product: { id: number; produto: string; familia: string; categoria: string | null; potencia: string | null }) => {
    setSourceId(product.id);
    setSourceSearch(product.produto);
    setTargetFamily(product.familia);
    setTargetCategory(product.categoria || "_all");
    setTargetPower(product.categoria === "PERFIS" ? (product.potencia || "") : "");
    setProductTerm(product.produto.split(/\s+/).slice(0, 3).join(" "));
    toast.success("Produto de referência selecionado. Revise o público antes de gerar a prévia.");
  };

  return <div className="space-y-6 max-w-6xl mx-auto animate-fade-in">
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
      <div><div className="flex items-center gap-3"><FileStack className="w-7 h-7 text-primary" /><h1 className="text-2xl font-bold tracking-tight">DOCUMENTOS EM LOTE</h1></div><p className="text-sm text-muted-foreground mt-2 max-w-2xl">Envie o arquivo uma única vez no cadastro de um produto de referência e compartilhe-o aqui com os produtos equivalentes. As referências são reutilizadas, sem novo upload nem duplicação no storage.</p></div>
      <Button variant="outline" onClick={() => navigate("/")}>VOLTAR AOS PRODUTOS</Button>
    </div>

    <section className="alfalux-card p-5">
      <div className="flex items-center gap-2 mb-4"><span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold grid place-items-center">1</span><h2 className="font-semibold">Produto de referência</h2></div>
      <div className="relative max-w-2xl">
        <Label htmlFor="source-search">Busque o produto que já possui os documentos</Label>
        <div className="relative mt-2"><Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" /><Input id="source-search" className="pl-9" value={sourceSearch} onChange={(event) => { setSourceSearch(event.target.value); setSourceId(null); }} placeholder="Ex.: BLAZE H P IF 1B 575MM 18W" /></div>
        {sourceSearch.trim().length >= 3 && !sourceId && <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-xl max-h-72 overflow-y-auto">{matchingProducts?.items.map((product) => <button key={product.id} type="button" onClick={() => chooseSource(product)} className="w-full text-left px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/50"><p className="text-sm font-medium">{product.produto}</p><p className="text-xs text-muted-foreground mt-1">{product.sku} · {product.familia} · {product.potencia || "sem potência"}</p></button>)}{matchingProducts && matchingProducts.items.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum produto encontrado.</p>}</div>}
      </div>
      {sourceId && <div className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-400 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2"><CheckCircle2 className="w-4 h-4" />Produto de referência selecionado</div>}
    </section>

    <section className="alfalux-card p-5">
      <div className="flex items-center gap-2 mb-4"><span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold grid place-items-center">2</span><h2 className="font-semibold">Documentos e público</h2></div>
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="space-y-4"><Label>Documentos do produto de referência a compartilhar</Label><div className="grid sm:grid-cols-3 gap-3">{documentOptions.map((document) => <label key={document.type} className="flex items-center gap-3 rounded-lg border border-border/60 p-3 cursor-pointer hover:bg-muted/20"><Checkbox checked={selectedTypes.includes(document.type)} onCheckedChange={(checked) => setSelectedTypes((current) => checked ? [...current, document.type] : current.filter((item) => item !== document.type))} /><span className="text-[10px] font-bold rounded border border-primary/30 text-primary px-1.5 py-0.5">{document.badge}</span><span className="text-sm">{document.label}</span></label>)}</div><label className="flex items-start gap-3 rounded-lg border border-border/60 p-3 cursor-pointer"><Checkbox checked={replaceExisting} onCheckedChange={(checked) => setReplaceExisting(checked === true)} /><span><span className="text-sm font-medium block">Substituir documentos existentes</span><span className="text-xs text-muted-foreground">Se desmarcado, arquivos já atribuídos a um produto são preservados.</span></span></label></div>
        <div className="grid sm:grid-cols-2 gap-3 content-start"><div className="space-y-2"><Label>Família</Label><Select value={targetFamily || "_none"} onValueChange={(value) => setTargetFamily(value === "_none" ? "" : value)}><SelectTrigger><SelectValue placeholder="Selecione a família" /></SelectTrigger><SelectContent><SelectItem value="_none">Selecione a família</SelectItem>{families.map((family) => <SelectItem key={family} value={family}>{family}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Categoria</Label><Select value={targetCategory} onValueChange={(value) => { setTargetCategory(value); if (value !== "PERFIS") setTargetPower(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="_all">Todas</SelectItem><SelectItem value="PERFIS">Perfis</SelectItem></SelectContent></Select></div>{targetCategory === "PERFIS" && <div className="space-y-2"><Label>Potência</Label><Select value={targetPower || "_all"} onValueChange={(value) => setTargetPower(value === "_all" ? "" : value)}><SelectTrigger><SelectValue placeholder="Todas as potências" /></SelectTrigger><SelectContent><SelectItem value="_all">Todas as potências</SelectItem>{powers.map((power) => <SelectItem key={power} value={power}>{power.replace("-", " ")}</SelectItem>)}</SelectContent></Select></div>}<div className="space-y-2"><Label>Nome do produto contém</Label><Input value={productTerm} onChange={(event) => setProductTerm(event.target.value)} placeholder="Ex.: BLAZE H P" /></div></div>
      </div>
      <div className="mt-5 pt-5 border-t border-border/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"><p className="text-xs text-muted-foreground">A prévia mostra os produtos que serão afetados antes de qualquer alteração.</p><Button disabled={!canPreview || preview.isFetching} onClick={() => void preview.refetch()}><Files className="w-4 h-4 mr-2" />{preview.isFetching ? "GERANDO PRÉVIA..." : "GERAR PRÉVIA"}</Button></div>
    </section>

    {preview.data && <section className="alfalux-card overflow-hidden"><div className="p-5 border-b border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-4"><div><p className="font-semibold">Prévia de aplicação</p><p className="text-sm text-muted-foreground mt-1"><strong className="text-foreground">{preview.data.affected}</strong> de {preview.data.total} produto(s) receberão os documentos selecionados.</p></div><Button disabled={!preview.data.affected || apply.isPending} onClick={() => { if (window.confirm(`Aplicar documentos compartilhados em ${preview.data.affected} produto(s)?`)) apply.mutate(input); }}><UploadCloud className="w-4 h-4 mr-2" />{apply.isPending ? "APLICANDO..." : `APLICAR EM ${preview.data.affected} PRODUTOS`}</Button></div><div className="overflow-x-auto"><table className="w-full min-w-[650px]"><thead><tr className="bg-muted/20 border-b border-border/60"><th className="text-left p-3 text-[11px] tracking-wider">PRODUTO</th><th className="text-left p-3 text-[11px] tracking-wider">SKU</th><th className="text-left p-3 text-[11px] tracking-wider">POTÊNCIA</th><th className="text-left p-3 text-[11px] tracking-wider">RESULTADO</th></tr></thead><tbody>{preview.data.items.map((item) => <tr key={item.id} className="border-b border-border/40 last:border-0"><td className="p-3 text-sm">{item.produto}</td><td className="p-3 text-xs text-muted-foreground font-mono">{item.sku}</td><td className="p-3 text-xs">{item.potencia || "—"}</td><td className="p-3 text-xs">{item.isSource ? <span className="text-muted-foreground">Produto de referência</span> : item.willChange ? <span className="text-emerald-400">Receberá {item.documentsToApply.map((type) => documentOptions.find((item) => item.type === type)?.badge).join(", ")}</span> : <span className="text-muted-foreground">Sem alteração</span>}</td></tr>)}</tbody></table></div></section>}
  </div>;
}
