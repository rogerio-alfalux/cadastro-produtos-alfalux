import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ComponentSelect } from "@/components/ComponentSelect";

const TIPO_LABELS: Record<string, string> = {
  DRIVER_ONOFF_220: "ON/OFF Driver 220V",
  DRIVER_ONOFF_BIVOLT: "ON/OFF Driver Bivolt",
  DRIVER_DIM_110V: "DIM 1-10V",
  DRIVER_DIM_DALI: "DIM DALI",
  DRIVER_DIM_TRIAC_110V: "DIM TRIAC 110V",
  DRIVER_DIM_TRIAC_220V: "DIM TRIAC 220V",
  OTICA: "Óptica",
  HOLDER: "Holder",
  DISSIPADOR: "Dissipador",
  MODULO_LED: "Módulo LED",
};

const TIPOS = Object.keys(TIPO_LABELS) as Array<keyof typeof TIPO_LABELS>;

type Step = "configure" | "preview" | "done";

export default function BulkReplace() {
  const [tipo, setTipo] = useState<string>("");
  const [modeloAtual, setModeloAtual] = useState("");
  const [modeloNovo, setModeloNovo] = useState("");
  const [familia, setFamilia] = useState("");
  const [step, setStep] = useState<Step>("configure");
  const [result, setResult] = useState<{ total: number } | null>(null);
  // IDs selecionados para substituição (null = todos)
  const [selectedIds, setSelectedIds] = useState<Set<number> | null>(null);

  const { data: familias } = trpc.components.families.useQuery();

  // Preview query — only runs when step is "preview"
  const previewEnabled = step === "preview" && !!tipo && !!modeloAtual;
  const { data: preview, isLoading: previewLoading } = trpc.components.previewReplace.useQuery(
    { tipo: tipo as any, modeloAtual, familia: familia || undefined },
    { enabled: previewEnabled }
  );

  // Inicializar todos os produtos como selecionados quando o preview carrega
  useEffect(() => {
    if (preview && preview.produtos) {
      setSelectedIds(new Set(preview.produtos.map((p) => p.id)));
    }
  }, [preview]);


  const executeMutation = trpc.components.executeReplace.useMutation({
    onSuccess: (data) => {
      setResult({ total: data.totalUpdated });
      setStep("done");
      toast.success(`Substituição concluída! ${data.totalUpdated} produto(s) atualizado(s).`);
    },
    onError: (err) => {
      toast.error("Erro ao executar substituição: " + err.message);
    },
  });

  const canPreview = !!tipo && !!modeloAtual && !!modeloNovo && modeloAtual !== modeloNovo;

  const allSelected = useMemo(() => {
    if (!preview || !selectedIds) return false;
    return preview.produtos.every((p: any) => selectedIds.has(p.id));
  }, [preview, selectedIds]);

  const someSelected = useMemo(() => {
    if (!preview || !selectedIds) return false;
    return preview.produtos.some((p: any) => selectedIds.has(p.id));
  }, [preview, selectedIds]);

  const selectedCount = selectedIds?.size ?? 0;

  function toggleProduct(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!preview) return;
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(preview.produtos.map((p: any) => p.id)));
    }
  }

  function handleReset() {
    setTipo("");
    setModeloAtual("");
    setModeloNovo("");
    setFamilia("");
    setStep("configure");
    setResult(null);
    setSelectedIds(null);
  }

  function handleExecute() {
    const ids = selectedIds ? Array.from(selectedIds) : undefined;
    executeMutation.mutate({
      tipo: tipo as any,
      modeloAtual,
      modeloNovo,
      familia: familia || undefined,
      productIds: ids && ids.length > 0 ? ids : undefined,
    });
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Substituição em Massa de Componentes</h1>
        <p className="text-muted-foreground mt-1">
          Substitua um componente em todos os produtos de uma vez. Veja o impacto antes de confirmar.
        </p>
      </div>

      {step === "done" && result && (
        <Card className="border-green-500/40 bg-green-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="text-3xl">✅</div>
              <div>
                <p className="text-lg font-semibold text-green-400">Substituição concluída!</p>
                <p className="text-muted-foreground">
                  <span className="font-bold text-foreground">{result.total}</span> produto(s) atualizado(s) com sucesso.
                </p>
              </div>
            </div>
            <Button className="mt-4" variant="outline" onClick={handleReset}>
              Fazer outra substituição
            </Button>
          </CardContent>
        </Card>
      )}

      {step !== "done" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Configure a substituição</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Tipo de componente */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Tipo de componente
              </label>
              <Select
                value={tipo}
                onValueChange={(v) => {
                  setTipo(v);
                  setModeloAtual("");
                  setModeloNovo("");
                  setStep("configure");
                  setSelectedIds(null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Componente atual */}
            {tipo && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Componente a substituir (atual)
                </label>
                <ComponentSelect
                  tipo={tipo as any}
                  value={modeloAtual}
                  onChange={(v: string) => { setModeloAtual(v); setStep("configure"); setSelectedIds(null); }}
                  placeholder={`Buscar ${TIPO_LABELS[tipo]}...`}
                />
              </div>
            )}

            {/* Componente novo */}
            {tipo && modeloAtual && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Substituir por (novo)
                </label>
                <ComponentSelect
                  tipo={tipo as any}
                  value={modeloNovo}
                  onChange={(v: string) => { setModeloNovo(v); setStep("configure"); setSelectedIds(null); }}
                  placeholder={`Buscar ${TIPO_LABELS[tipo]}...`}
                />
                {modeloNovo && modeloNovo === modeloAtual && (
                  <p className="text-xs text-destructive">O componente novo deve ser diferente do atual.</p>
                )}
              </div>
            )}

            {/* Filtro de família (opcional) */}
            {tipo && modeloAtual && modeloNovo && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Filtrar por família <span className="text-xs normal-case font-normal">(opcional — deixe em branco para substituir em todos os produtos)</span>
                </label>
                <Select
                  value={familia || "__all__"}
                  onValueChange={(v) => { setFamilia(v === "__all__" ? "" : v); setStep("configure"); setSelectedIds(null); }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Todas as famílias" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as famílias</SelectItem>
                    {(familias ?? []).map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {canPreview && step === "configure" && (
              <Button
                className="w-full"
                onClick={() => setStep("preview")}
              >
                Ver produtos afetados →
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview com seleção granular */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>2. Selecione os produtos para substituir</span>
              {!previewLoading && preview && (
                <Badge variant={selectedCount > 0 ? "default" : "secondary"}>
                  {selectedCount} / {preview.total} selecionado(s)
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary */}
            <div className="rounded-lg bg-muted/40 p-4 space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Tipo:</span>
                <span className="font-medium">{TIPO_LABELS[tipo]}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Atual:</span>
                <span className="font-medium text-destructive/80 break-all">{modeloAtual}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Novo:</span>
                <span className="font-medium text-green-400 break-all">{modeloNovo}</span>
              </div>
              {familia && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Família:</span>
                  <span className="font-medium">{familia}</span>
                </div>
              )}
            </div>

            {previewLoading && (
              <div className="text-center py-8 text-muted-foreground">Carregando produtos afetados...</div>
            )}

            {!previewLoading && preview && preview.total === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum produto encontrado com esse componente{familia ? ` na família "${familia}"` : ""}.
              </div>
            )}

            {!previewLoading && preview && preview.total > 0 && (
              <>
                {/* Controles de seleção */}
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                    />
                    <label htmlFor="select-all" className="text-sm cursor-pointer select-none">
                      {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                    </label>
                  </div>
                  {selectedCount > 0 && selectedCount < preview.total && (
                    <span className="text-xs text-muted-foreground">
                      {preview.total - selectedCount} produto(s) excluído(s) da substituição
                    </span>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto rounded border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-10"></th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Produto</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">SKU</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Família</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.produtos.map((p: any, i: number) => {
                        const checked = selectedIds?.has(p.id) ?? false;
                        return (
                          <tr
                            key={p.id}
                            className={`cursor-pointer transition-colors ${checked ? (i % 2 === 0 ? "bg-background" : "bg-muted/20") : "opacity-40 bg-muted/5"}`}
                            onClick={() => toggleProduct(p.id)}
                          >
                            <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleProduct(p.id)}
                              />
                            </td>
                            <td className="px-3 py-2 text-foreground">{p.produto}</td>
                            <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{p.sku}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.familia}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <Separator />

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep("configure")}
                    disabled={executeMutation.isPending}
                  >
                    ← Voltar e ajustar
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    disabled={executeMutation.isPending || selectedCount === 0}
                    onClick={handleExecute}
                  >
                    {executeMutation.isPending
                      ? "Substituindo..."
                      : selectedCount === 0
                        ? "Nenhum produto selecionado"
                        : `Confirmar e substituir em ${selectedCount} produto(s)`}
                  </Button>
                </div>
              </>
            )}

            {!previewLoading && preview && preview.total === 0 && (
              <Button variant="outline" onClick={() => setStep("configure")}>
                ← Voltar
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
