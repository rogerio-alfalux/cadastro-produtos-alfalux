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

type Step = "configure" | "confirm" | "done";

export default function BulkReplace() {
  const [tipo, setTipo] = useState<string>("");
  const [modeloAtual, setModeloAtual] = useState("");
  const [modeloNovo, setModeloNovo] = useState("");
  const [familia, setFamilia] = useState("");
  const [step, setStep] = useState<Step>("configure");
  const [result, setResult] = useState<{ total: number } | null>(null);
  // IDs selecionados para substituição
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: familias } = trpc.components.families.useQuery();

  // Busca os produtos afetados assim que tipo + modeloAtual + família estão preenchidos
  const productListEnabled = !!tipo && !!modeloAtual && !!familia;
  const { data: productList, isLoading: productListLoading } = trpc.components.previewReplace.useQuery(
    { tipo: tipo as any, modeloAtual, familia: familia || undefined },
    { enabled: productListEnabled }
  );

  // Quando a lista de produtos carrega, selecionar todos por padrão
  useEffect(() => {
    if (productList && productList.produtos) {
      setSelectedIds(new Set(productList.produtos.map((p) => p.id)));
    }
  }, [productList]);

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

  const canConfirm = !!tipo && !!modeloAtual && !!modeloNovo && modeloAtual !== modeloNovo;

  // Se não há família selecionada, a seleção de produtos não se aplica — aplica em todos
  const applyToAll = !familia;

  const allSelected = useMemo(() => {
    if (!productList) return false;
    return productList.produtos.every((p) => selectedIds.has(p.id));
  }, [productList, selectedIds]);

  const selectedCount = selectedIds.size;
  const totalCount = productList?.total ?? 0;

  function toggleProduct(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!productList) return;
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(productList.produtos.map((p) => p.id)));
    }
  }

  function handleReset() {
    setTipo("");
    setModeloAtual("");
    setModeloNovo("");
    setFamilia("");
    setStep("configure");
    setResult(null);
    setSelectedIds(new Set());
  }

  function handleExecute() {
    // Se não há família, aplica em todos (sem filtro de IDs)
    // Se há família, aplica apenas nos IDs selecionados
    const ids = familia && selectedIds.size > 0 ? Array.from(selectedIds) : undefined;
    executeMutation.mutate({
      tipo: tipo as any,
      modeloAtual,
      modeloNovo,
      familia: familia || undefined,
      productIds: ids,
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

      {/* Resultado final */}
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

      {/* Formulário de configuração */}
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
                  setFamilia("");
                  setSelectedIds(new Set());
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
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
                  onChange={(v: string) => {
                    setModeloAtual(v);
                    setFamilia("");
                    setSelectedIds(new Set());
                  }}
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
                  onChange={(v: string) => setModeloNovo(v)}
                  placeholder={`Buscar ${TIPO_LABELS[tipo]}...`}
                />
                {modeloNovo && modeloNovo === modeloAtual && (
                  <p className="text-xs text-destructive">O componente novo deve ser diferente do atual.</p>
                )}
              </div>
            )}

            {/* Filtro de família */}
            {tipo && modeloAtual && modeloNovo && modeloAtual !== modeloNovo && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Filtrar por família{" "}
                  <span className="text-xs normal-case font-normal">
                    (opcional — deixe em branco para substituir em todos os produtos)
                  </span>
                </label>
                <Select
                  value={familia || "__all__"}
                  onValueChange={(v) => {
                    setFamilia(v === "__all__" ? "" : v);
                    setSelectedIds(new Set());
                  }}
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

            {/* Lista de produtos da família com checkboxes */}
            {familia && tipo && modeloAtual && modeloNovo && modeloAtual !== modeloNovo && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Produtos na família {familia}
                  </label>
                  {!productListLoading && productList && productList.total > 0 && (
                    <Badge variant={selectedCount > 0 ? "default" : "secondary"}>
                      {selectedCount} / {totalCount} selecionado(s)
                    </Badge>
                  )}
                </div>

                {productListLoading && (
                  <div className="text-sm text-muted-foreground py-3 text-center">
                    Carregando produtos...
                  </div>
                )}

                {!productListLoading && productList && productList.total === 0 && (
                  <div className="text-sm text-muted-foreground py-3 text-center rounded border border-border">
                    Nenhum produto nessa família usa o componente selecionado.
                  </div>
                )}

                {!productListLoading && productList && productList.total > 0 && (
                  <div className="rounded border border-border overflow-hidden">
                    {/* Cabeçalho com "selecionar todos" */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 border-b border-border">
                      <Checkbox
                        id="select-all"
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                      />
                      <label htmlFor="select-all" className="text-sm font-medium cursor-pointer select-none">
                        {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                      </label>
                    </div>
                    {/* Lista de produtos */}
                    <div className="max-h-56 overflow-y-auto">
                      {productList.produtos.map((p, i) => {
                        const checked = selectedIds.has(p.id);
                        return (
                          <div
                            key={p.id}
                            className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-muted/30 ${i % 2 === 0 ? "bg-background" : "bg-muted/10"} ${!checked ? "opacity-50" : ""}`}
                            onClick={() => toggleProduct(p.id)}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleProduct(p.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-foreground truncate block">{p.produto}</span>
                              <span className="text-xs text-muted-foreground font-mono">{p.sku}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Botão de confirmar */}
            {canConfirm && (
              <div className="pt-1">
                <Separator className="mb-4" />
                {/* Resumo da operação */}
                <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-sm mb-4">
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Atual:</span>
                    <span className="font-medium text-destructive/80 break-all">{modeloAtual}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Novo:</span>
                    <span className="font-medium text-green-400 break-all">{modeloNovo}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-24 shrink-0">Escopo:</span>
                    <span className="font-medium">
                      {applyToAll
                        ? "Todos os produtos"
                        : selectedCount === 0
                          ? <span className="text-destructive">Nenhum produto selecionado</span>
                          : selectedCount === totalCount
                            ? `Todos os ${totalCount} produto(s) da família ${familia}`
                            : `${selectedCount} de ${totalCount} produto(s) da família ${familia}`}
                    </span>
                  </div>
                </div>

                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  disabled={executeMutation.isPending || (!applyToAll && selectedCount === 0)}
                  onClick={handleExecute}
                >
                  {executeMutation.isPending
                    ? "Substituindo..."
                    : applyToAll
                      ? "Confirmar e substituir em todos os produtos"
                      : selectedCount === 0
                        ? "Selecione ao menos um produto"
                        : `Confirmar e substituir em ${selectedCount} produto(s)`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
