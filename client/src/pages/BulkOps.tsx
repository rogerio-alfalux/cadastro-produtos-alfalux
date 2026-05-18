import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// ─── Types ────────────────────────────────────────────────────────────────────

type DriverType = "DRIVER_ONOFF_220" | "DRIVER_ONOFF_BIVOLT" | "DRIVER_DIM_110V" | "DRIVER_DIM_DALI";

const DRIVER_LABELS: Record<DriverType, string> = {
  DRIVER_ONOFF_220: "ON/OFF 220Vac",
  DRIVER_ONOFF_BIVOLT: "ON/OFF BIVOLT",
  DRIVER_DIM_110V: "DIM 1-10V",
  DRIVER_DIM_DALI: "DIM DALI",
};

// ─── Shared filter bar ────────────────────────────────────────────────────────

interface FilterBarProps {
  familia: string;
  setFamilia: (v: string) => void;
  categoria: string;
  setCategoria: (v: string) => void;
  moduloLedContem: string;
  setModuloLedContem: (v: string) => void;
  families: string[];
  categories: string[];
}

function FilterBar({ familia, setFamilia, categoria, setCategoria, moduloLedContem, setModuloLedContem, families, categories }: FilterBarProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Família</Label>
        <Select value={familia} onValueChange={setFamilia}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Todas as famílias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as famílias</SelectItem>
            {families.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Categoria</Label>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Módulo LED contém</Label>
        <Input
          className="h-9"
          placeholder="Ex: 2 barras, 18W, STRIPFLEX..."
          value={moduloLedContem}
          onChange={(e) => setModuloLedContem(e.target.value)}
        />
      </div>
    </div>
  );
}

// ─── Preview table ────────────────────────────────────────────────────────────

function PreviewTable({ produtos, count, label }: { produtos: any[]; count: number; label: string }) {
  if (count === 0) return (
    <div className="text-sm text-muted-foreground italic py-2">Nenhum produto encontrado com os filtros selecionados.</div>
  );
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-sm font-bold">{count}</Badge>
        <span className="text-sm text-muted-foreground">{label}</span>
        {count > 20 && <span className="text-xs text-muted-foreground">(mostrando os primeiros 20)</span>}
      </div>
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Família</th>
              <th className="text-left px-3 py-2 font-semibold">Produto</th>
              <th className="text-left px-3 py-2 font-semibold">SKU</th>
              <th className="text-left px-3 py-2 font-semibold">Valor Atual</th>
            </tr>
          </thead>
          <tbody>
            {produtos.map((p, i) => (
              <tr key={i} className="border-t hover:bg-muted/30 transition-colors">
                <td className="px-3 py-1.5 font-medium">{p.familia}</td>
                <td className="px-3 py-1.5">{p.produto}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{p.sku}</td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {p.custoLuminaria ?? p.custoAtual ?? p.driverAtual ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab: Custo da Luminária ──────────────────────────────────────────────────

function TabCustoLuminaria({ families, categories }: { families: string[]; categories: string[] }) {
  const [familia, setFamilia] = useState("__all__");
  const [categoria, setCategoria] = useState("__all__");
  const [moduloLedContem, setModuloLedContem] = useState("");
  const [novoCusto, setNovoCusto] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const filterInput = useMemo(() => ({
    familia: familia === "__all__" ? undefined : familia,
    categoria: categoria === "__all__" ? undefined : categoria,
    moduloLedContem: moduloLedContem.trim() || undefined,
  }), [familia, categoria, moduloLedContem]);

  const { data: preview } = trpc.bulkOps.previewCostLuminaria.useQuery(filterInput);
  const utils = trpc.useUtils();
  const apply = trpc.bulkOps.applyCostLuminaria.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.updated} produto(s) atualizados com sucesso.`);
      utils.bulkOps.previewCostLuminaria.invalidate();
      setNovoCusto("");
      setConfirmOpen(false);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros de Seleção</CardTitle>
          <CardDescription>Selecione quais produtos terão o custo da luminária alterado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterBar
            familia={familia} setFamilia={setFamilia}
            categoria={categoria} setCategoria={setCategoria}
            moduloLedContem={moduloLedContem} setModuloLedContem={setModuloLedContem}
            families={families} categories={categories}
          />
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Prévia dos Produtos Afetados</CardTitle>
          </CardHeader>
          <CardContent>
            <PreviewTable
              produtos={preview.produtos}
              count={preview.count}
              label="produto(s) terão o custo da luminária alterado"
            />
          </CardContent>
        </Card>
      )}

      {(preview?.count ?? 0) > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Novo Custo da Luminária</CardTitle>
            <CardDescription>Informe o novo valor de custo a ser aplicado em todos os produtos selecionados.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Novo Custo (R$)</Label>
                <Input
                  placeholder="Ex: 45.90"
                  value={novoCusto}
                  onChange={(e) => setNovoCusto(e.target.value)}
                  className="h-9 max-w-xs"
                />
              </div>
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!novoCusto.trim() || apply.isPending}
                className="h-9"
              >
                Aplicar em {preview?.count} produto(s)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Alteração em Massa</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a alterar o custo da luminária de <strong>{preview?.count} produto(s)</strong> para <strong>R$ {novoCusto}</strong>.
              {familia !== "__all__" && <> Família: <strong>{familia}</strong>.</>}
              {categoria !== "__all__" && <> Categoria: <strong>{categoria}</strong>.</>}
              {moduloLedContem && <> Módulo LED contém: <strong>{moduloLedContem}</strong>.</>}
              {" "}Esta ação não pode ser desfeita automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => apply.mutate({ ...filterInput, novoCusto })}
              disabled={apply.isPending}
            >
              {apply.isPending ? "Aplicando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Tab: Custo de Driver ─────────────────────────────────────────────────────

function TabCustoDriver({ families, categories }: { families: string[]; categories: string[] }) {
  const [tipoDriver, setTipoDriver] = useState<DriverType>("DRIVER_ONOFF_220");
  const [familia, setFamilia] = useState("__all__");
  const [categoria, setCategoria] = useState("__all__");
  const [moduloLedContem, setModuloLedContem] = useState("");
  const [driverAtual, setDriverAtual] = useState("__all__");
  const [novoCusto, setNovoCusto] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: driverValues = [] } = trpc.bulkOps.driverValues.useQuery({ tipo: tipoDriver });

  const filterInput = useMemo(() => ({
    tipo: tipoDriver,
    familia: familia === "__all__" ? undefined : familia,
    categoria: categoria === "__all__" ? undefined : categoria,
    moduloLedContem: moduloLedContem.trim() || undefined,
    driverAtual: driverAtual === "__all__" ? undefined : driverAtual,
  }), [tipoDriver, familia, categoria, moduloLedContem, driverAtual]);

  const { data: preview } = trpc.bulkOps.previewCostDriver.useQuery(filterInput);
  const utils = trpc.useUtils();
  const apply = trpc.bulkOps.applyCostDriver.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.updated} produto(s) atualizados com sucesso.`);
      utils.bulkOps.previewCostDriver.invalidate();
      setNovoCusto("");
      setConfirmOpen(false);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tipo de Driver</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DRIVER_LABELS) as DriverType[]).map((t) => (
              <Button
                key={t}
                variant={tipoDriver === t ? "default" : "outline"}
                size="sm"
                onClick={() => { setTipoDriver(t); setDriverAtual("__all__"); }}
              >
                {DRIVER_LABELS[t]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros de Seleção</CardTitle>
          <CardDescription>Filtre por família, categoria, módulo LED e/ou driver específico.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterBar
            familia={familia} setFamilia={setFamilia}
            categoria={categoria} setCategoria={setCategoria}
            moduloLedContem={moduloLedContem} setModuloLedContem={setModuloLedContem}
            families={families} categories={categories}
          />
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Driver {DRIVER_LABELS[tipoDriver]} específico
            </Label>
            <Select value={driverAtual} onValueChange={setDriverAtual}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Todos os drivers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os drivers</SelectItem>
                {driverValues.map((d: string) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Prévia dos Produtos Afetados</CardTitle>
          </CardHeader>
          <CardContent>
            <PreviewTable
              produtos={preview.produtos}
              count={preview.count}
              label={`produto(s) terão o custo do driver ${DRIVER_LABELS[tipoDriver]} alterado`}
            />
          </CardContent>
        </Card>
      )}

      {(preview?.count ?? 0) > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Novo Custo do Driver</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Novo Custo (R$)</Label>
                <Input
                  placeholder="Ex: 28.50"
                  value={novoCusto}
                  onChange={(e) => setNovoCusto(e.target.value)}
                  className="h-9 max-w-xs"
                />
              </div>
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!novoCusto.trim() || apply.isPending}
                className="h-9"
              >
                Aplicar em {preview?.count} produto(s)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Alteração em Massa</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a alterar o custo do driver <strong>{DRIVER_LABELS[tipoDriver]}</strong> de{" "}
              <strong>{preview?.count} produto(s)</strong> para <strong>R$ {novoCusto}</strong>.
              {" "}Esta ação não pode ser desfeita automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => apply.mutate({ ...filterInput, novoCusto })}
              disabled={apply.isPending}
            >
              {apply.isPending ? "Aplicando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Tab: Gestão de Drivers ───────────────────────────────────────────────────

function TabGestaoDrivers({ families, categories }: { families: string[]; categories: string[] }) {
  const [tipoDriver, setTipoDriver] = useState<DriverType>("DRIVER_DIM_DALI");
  const [acao, setAcao] = useState<"INSERIR" | "REMOVER">("INSERIR");
  const [familia, setFamilia] = useState("__all__");
  const [categoria, setCategoria] = useState("__all__");
  const [moduloLedContem, setModuloLedContem] = useState("");
  const [driverAtual, setDriverAtual] = useState("__all__");
  const [novoDriver, setNovoDriver] = useState("");
  const [novoCusto, setNovoCusto] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: driverValues = [] } = trpc.bulkOps.driverValues.useQuery({ tipo: tipoDriver });

  const filterInput = useMemo(() => ({
    tipo: tipoDriver,
    acao,
    familia: familia === "__all__" ? undefined : familia,
    categoria: categoria === "__all__" ? undefined : categoria,
    moduloLedContem: moduloLedContem.trim() || undefined,
    driverAtual: (acao === "REMOVER" && driverAtual !== "__all__") ? driverAtual : undefined,
  }), [tipoDriver, acao, familia, categoria, moduloLedContem, driverAtual]);

  const { data: preview } = trpc.bulkOps.previewDriver.useQuery(filterInput);
  const utils = trpc.useUtils();
  const apply = trpc.bulkOps.applyDriver.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.updated} produto(s) atualizados com sucesso.`);
      utils.bulkOps.previewDriver.invalidate();
      utils.bulkOps.driverValues.invalidate();
      setNovoDriver("");
      setNovoCusto("");
      setConfirmOpen(false);
    },
    onError: (err) => toast.error(`Erro: ${err.message}`),
  });

  const canApply = acao === "REMOVER" || novoDriver.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Tipo de Driver */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tipo de Driver</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DRIVER_LABELS) as DriverType[]).map((t) => (
              <Button
                key={t}
                variant={tipoDriver === t ? "default" : "outline"}
                size="sm"
                onClick={() => { setTipoDriver(t); setDriverAtual("__all__"); }}
              >
                {DRIVER_LABELS[t]}
              </Button>
            ))}
          </div>
          <Separator />
          <div className="flex gap-2">
            <Button
              variant={acao === "INSERIR" ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setAcao("INSERIR")}
            >
              ＋ Inserir Driver
            </Button>
            <Button
              variant={acao === "REMOVER" ? "destructive" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setAcao("REMOVER")}
            >
              × Remover Driver
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros de Seleção</CardTitle>
          <CardDescription>
            {acao === "INSERIR"
              ? `Serão afetados apenas produtos que ainda NÃO têm driver ${DRIVER_LABELS[tipoDriver]} cadastrado.`
              : `Serão afetados apenas produtos que JÁ têm driver ${DRIVER_LABELS[tipoDriver]} cadastrado.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FilterBar
            familia={familia} setFamilia={setFamilia}
            categoria={categoria} setCategoria={setCategoria}
            moduloLedContem={moduloLedContem} setModuloLedContem={setModuloLedContem}
            families={families} categories={categories}
          />
          {acao === "REMOVER" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Remover apenas este driver (opcional)
              </Label>
              <Select value={driverAtual} onValueChange={setDriverAtual}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos os drivers deste tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os drivers deste tipo</SelectItem>
                  {driverValues.map((d: string) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prévia */}
      {preview && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Prévia dos Produtos Afetados</CardTitle>
          </CardHeader>
          <CardContent>
            <PreviewTable
              produtos={preview.produtos}
              count={preview.count}
              label={`produto(s) ${acao === "INSERIR" ? "receberão" : "terão removido"} o driver ${DRIVER_LABELS[tipoDriver]}`}
            />
          </CardContent>
        </Card>
      )}

      {/* Ação */}
      {(preview?.count ?? 0) > 0 && (
        <Card className={acao === "REMOVER" ? "border-destructive/30 bg-destructive/5" : "border-primary/30 bg-primary/5"}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {acao === "INSERIR" ? "Dados do Novo Driver" : "Confirmar Remoção"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {acao === "INSERIR" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Modelo do Driver *</Label>
                  <Input
                    placeholder="Ex: LIFUD 40W 1000MA BIVOLT..."
                    value={novoDriver}
                    onChange={(e) => setNovoDriver(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custo (R$) — opcional</Label>
                  <Input
                    placeholder="Ex: 32.00"
                    value={novoCusto}
                    onChange={(e) => setNovoCusto(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            )}
            <Button
              variant={acao === "REMOVER" ? "destructive" : "default"}
              onClick={() => setConfirmOpen(true)}
              disabled={!canApply || apply.isPending}
              className="h-9"
            >
              {acao === "INSERIR"
                ? `Inserir driver em ${preview?.count} produto(s)`
                : `Remover driver de ${preview?.count} produto(s)`}
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {acao === "INSERIR" ? "Confirmar Inserção em Massa" : "Confirmar Remoção em Massa"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {acao === "INSERIR" ? (
                <>Você está prestes a inserir o driver <strong>{DRIVER_LABELS[tipoDriver]}</strong> "<strong>{novoDriver}</strong>" em <strong>{preview?.count} produto(s)</strong>.</>
              ) : (
                <>Você está prestes a <strong>remover</strong> o driver <strong>{DRIVER_LABELS[tipoDriver]}</strong> de <strong>{preview?.count} produto(s)</strong>.</>
              )}
              {" "}Esta ação não pode ser desfeita automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => apply.mutate({
                ...filterInput,
                novoDriver: novoDriver.trim() || undefined,
                novoCusto: novoCusto.trim() || undefined,
              })}
              disabled={apply.isPending}
              className={acao === "REMOVER" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {apply.isPending ? "Aplicando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BulkOps() {
  const { data: families = [] } = trpc.bulkOps.families.useQuery();
  const { data: categories = [] } = trpc.bulkOps.categories.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Operações em Massa</h1>
        <p className="text-muted-foreground mt-1">
          Altere custos e gerencie drivers de múltiplos produtos simultaneamente usando filtros por família, categoria e módulo LED.
        </p>
      </div>

      <Tabs defaultValue="custo-luminaria" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-10">
          <TabsTrigger value="custo-luminaria" className="text-xs sm:text-sm">Custo da Luminária</TabsTrigger>
          <TabsTrigger value="custo-driver" className="text-xs sm:text-sm">Custo de Driver</TabsTrigger>
          <TabsTrigger value="gestao-drivers" className="text-xs sm:text-sm">Gestão de Drivers</TabsTrigger>
        </TabsList>

        <TabsContent value="custo-luminaria">
          <TabCustoLuminaria families={families} categories={categories} />
        </TabsContent>

        <TabsContent value="custo-driver">
          <TabCustoDriver families={families} categories={categories} />
        </TabsContent>

        <TabsContent value="gestao-drivers">
          <TabGestaoDrivers families={families} categories={categories} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
