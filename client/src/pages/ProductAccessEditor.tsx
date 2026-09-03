import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, DollarSign, ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type DocumentType = "datasheet" | "fotometria" | "desenhoTecnico" | "manualInstalacao";
type StoredDocument = { url: string; key: string; nome: string; mimeType: string };
type ProductDocuments = Partial<Record<DocumentType, StoredDocument>>;

const DOCUMENTS: Record<DocumentType, { badge: string; label: string; accept: string; hint: string }> = {
  datasheet: { badge: "DS", label: "Datasheet", accept: ".pdf,application/pdf", hint: "PDF" },
  fotometria: { badge: "IES", label: "Fotometria (IES)", accept: ".ies", hint: "IES" },
  desenhoTecnico: { badge: "DT", label: "Desenho Técnico", accept: ".pdf,.dwg,.dxf,.png,.jpg,.jpeg", hint: "PDF, DWG, DXF ou imagem" },
  manualInstalacao: { badge: "MI", label: "Manual de Instalação", accept: ".pdf,application/pdf", hint: "PDF" },
};

const COST_GROUPS = [
  {
    title: "Custos gerais e drivers",
    fields: [
      ["custoLuminaria", "Custo da luminária"],
      ["custoDriverOnoff220", "Driver ON/OFF 220V"],
      ["custoDriverOnoffBivolt", "Driver ON/OFF Bivolt"],
      ["custoDriverDim110v", "Driver DIM 1-10V"],
      ["custoDriverDimDali", "Driver DALI"],
      ["custoDriverDimTriac110v", "Driver TRIAC 110V"],
      ["custoDriverDimTriac220v", "Driver TRIAC 220V"],
    ],
  },
  {
    title: "Corpo e markups",
    fields: [
      ["custoCorpoOnoff220v", "Custo corpo ON/OFF 220V"], ["mkpPadraoOnoff220v", "Markup padrão ON/OFF 220V"], ["mkpMinimoOnoff220v", "Markup mínimo ON/OFF 220V"],
      ["custoCorpoOnoffBivolt", "Custo corpo ON/OFF Bivolt"], ["mkpPadraoOnoffBivolt", "Markup padrão ON/OFF Bivolt"], ["mkpMinimoOnoffBivolt", "Markup mínimo ON/OFF Bivolt"],
      ["custoCorpoDim110v", "Custo corpo DIM 1-10V"], ["mkpPadraoDim110v", "Markup padrão DIM 1-10V"], ["mkpMinimoDim110v", "Markup mínimo DIM 1-10V"],
      ["custoCorpoDimDali", "Custo corpo DALI"], ["mkpPadraoDimDali", "Markup padrão DALI"], ["mkpMinimoDimDali", "Markup mínimo DALI"],
      ["custoCorpoDimTriac110v", "Custo corpo TRIAC 110V"], ["mkpPadraoDimTriac110v", "Markup padrão TRIAC 110V"], ["mkpMinimoDimTriac110v", "Markup mínimo TRIAC 110V"],
      ["custoCorpoDimTriac220v", "Custo corpo TRIAC 220V"], ["mkpPadraoDimTriac220v", "Markup padrão TRIAC 220V"], ["mkpMinimoDimTriac220v", "Markup mínimo TRIAC 220V"],
      ["mkpMinimoDriver", "Markup mínimo do driver"],
    ],
  },
  {
    title: "Preços de venda",
    fields: [
      ["precoVendaOnoff220", "Preço ON/OFF 220V"], ["precoVendaOnoffBivolt", "Preço ON/OFF Bivolt"], ["precoVendaDim110v", "Preço DIM 1-10V"], ["precoVendaDimDali", "Preço DALI"],
      ["precoVendaOnoff220D1", "Preço ON/OFF 220V D1"], ["precoVendaOnoff220D1D2", "Preço ON/OFF 220V D1+D2"],
      ["precoVendaOnoffBivoltD1", "Preço Bivolt D1"], ["precoVendaOnoffBivoltD1D2", "Preço Bivolt D1+D2"],
      ["precoVendaDim110vD1", "Preço DIM 1-10V D1"], ["precoVendaDim110vD1D2", "Preço DIM 1-10V D1+D2"],
      ["precoVendaDimDaliD1", "Preço DALI D1"], ["precoVendaDimDaliD1D2", "Preço DALI D1+D2"],
    ],
  },
] as const;

function parseDocuments(raw: unknown): ProductDocuments {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as ProductDocuments : {};
  } catch {
    return {};
  }
}

function getDocumentViewUrls(raw: unknown): Partial<Record<DocumentType, string>> {
  const documents = parseDocuments(raw);
  return Object.fromEntries(
    (Object.keys(documents) as DocumentType[])
      .map((type) => [type, documents[type]?.url] as const)
      .filter((entry): entry is [DocumentType, string] => Boolean(entry[1])),
  );
}

export function ProductDocumentsEditor() {
  const [, params] = useRoute<{ id: string }>("/documentos/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id);
  const { data: product, isLoading } = trpc.products.getById.useQuery({ id }, { enabled: Number.isFinite(id) });
  const [documents, setDocuments] = useState<ProductDocuments>({});
  const [documentViewUrls, setDocumentViewUrls] = useState<Partial<Record<DocumentType, string>>>({});
  const [uploading, setUploading] = useState<DocumentType | null>(null);
  const refs = useRef<Partial<Record<DocumentType, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (!product) return;
    setDocuments(parseDocuments(product.documentos));
    setDocumentViewUrls(getDocumentViewUrls((product as Record<string, unknown>).documentosVisualizacao));
  }, [product]);
  const update = trpc.products.update.useMutation({ onError: (error) => toast.error(error.message) });

  const persist = async (next: ProductDocuments, successMessage: string) => {
    await update.mutateAsync({ id, data: { documentos: Object.keys(next).length ? JSON.stringify(next) : null } });
    setDocuments(next);
    setDocumentViewUrls((current) => Object.fromEntries(
      Object.entries(current).filter(([type]) => Boolean(next[type as DocumentType])),
    ) as Partial<Record<DocumentType, string>>);
    toast.success(successMessage);
  };

  const upload = async (type: DocumentType, file: File) => {
    setUploading(type);
    try {
      const body = new FormData();
      body.append("tipo", type);
      body.append("file", file);
      const response = await fetch("/api/products/upload-document", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Falha no upload");
      await persist({ ...documents, [type]: payload.documento }, `${DOCUMENTS[type].label} atualizado`);
      setDocumentViewUrls((current) => ({
        ...current,
        [type]: payload.documentoVisualizacao?.url || payload.documento?.url,
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload");
    } finally {
      setUploading(null);
      if (refs.current[type]) refs.current[type]!.value = "";
    }
  };

  if (isLoading) return <div className="alfalux-card p-8 text-muted-foreground">Carregando produto...</div>;
  if (!product) return <div className="alfalux-card p-8">Produto não encontrado.</div>;

  return <div className="space-y-6 max-w-5xl mx-auto">
    <Button variant="ghost" onClick={() => navigate("/")}><ArrowLeft className="w-4 h-4 mr-2" />Voltar aos produtos</Button>
    <div><div className="flex items-center gap-3"><FileText className="w-6 h-6 text-primary" /><h1 className="text-2xl font-bold">DOCUMENTOS DO PRODUTO</h1></div><p className="text-sm text-muted-foreground mt-2">{product.produto} · {product.sku}</p></div>
    <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {(Object.keys(DOCUMENTS) as DocumentType[]).map((type) => {
        const document = documents[type];
        return <section key={type} className="alfalux-card p-5 flex flex-col min-h-56">
          <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{DOCUMENTS[type].label}</p><p className="text-xs text-muted-foreground mt-1">{DOCUMENTS[type].hint} · até 25 MB</p></div><span className="text-[10px] font-bold tracking-wider text-primary border border-primary/30 rounded px-2 py-1">{DOCUMENTS[type].badge}</span></div>
          <div className="mt-5 flex-1"><p className="text-sm break-all">{document?.nome || "Nenhum arquivo anexado"}</p></div>
          <input ref={(element) => { refs.current[type] = element; }} type="file" className="hidden" accept={DOCUMENTS[type].accept} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(type, file); }} />
          <div className="flex gap-2 mt-5">
            <Button size="sm" className="flex-1" disabled={uploading === type || update.isPending} onClick={() => refs.current[type]?.click()}><Upload className="w-4 h-4 mr-2" />{document ? "Substituir" : "Anexar"}</Button>
            {document && <><Button size="icon" variant="outline" asChild><a href={`/api/products/${id}/document/${type}`} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a></Button><Button size="icon" variant="outline" className="text-destructive" onClick={() => { const next = { ...documents }; delete next[type]; void persist(next, `${DOCUMENTS[type].label} removido`); }}><Trash2 className="w-4 h-4" /></Button></>}
          </div>
        </section>;
      })}
    </div>
  </div>;
}

export function ProductCostsEditor() {
  const [, params] = useRoute<{ id: string }>("/custos/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id);
  const { data: product, isLoading } = trpc.products.getById.useQuery({ id }, { enabled: Number.isFinite(id) });
  const allFields = useMemo(() => COST_GROUPS.flatMap((group) => group.fields.map(([key]) => key)), []);
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!product) return;
    setValues(Object.fromEntries(allFields.map((key) => [key, String((product as Record<string, unknown>)[key] ?? "")])));
  }, [allFields, product]);
  const update = trpc.products.update.useMutation({
    onSuccess: () => toast.success("Custos e markups atualizados"),
    onError: (error) => toast.error(error.message),
  });

  if (isLoading) return <div className="alfalux-card p-8 text-muted-foreground">Carregando produto...</div>;
  if (!product) return <div className="alfalux-card p-8">Produto não encontrado.</div>;

  return <div className="space-y-6 max-w-6xl mx-auto">
    <Button variant="ghost" onClick={() => navigate("/")}><ArrowLeft className="w-4 h-4 mr-2" />Voltar aos produtos</Button>
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"><div><div className="flex items-center gap-3"><DollarSign className="w-6 h-6 text-amber-400" /><h1 className="text-2xl font-bold">CUSTOS E MARKUPS</h1></div><p className="text-sm text-muted-foreground mt-2">{product.produto} · {product.sku}</p></div><Button disabled={update.isPending} onClick={() => update.mutate({ id, data: values as never })}>{update.isPending ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}</Button></div>
    {COST_GROUPS.map((group) => <section key={group.title} className="alfalux-card p-5"><h2 className="text-sm font-semibold tracking-wider mb-4">{group.title.toUpperCase()}</h2><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{group.fields.map(([key, label]) => <div key={key} className="space-y-2"><Label htmlFor={key}>{label}</Label><Input id={key} inputMode="decimal" value={values[key] || ""} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} /></div>)}</div></section>)}
  </div>;
}
