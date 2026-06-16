import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { AlertCircle, RefreshCw, Search } from "lucide-react";

const COMPONENT_TYPES = [
  { value: "MODULO_LED", label: "Módulo LED" },
  { value: "OTICA", label: "Ótica" },
  { value: "HOLDER", label: "Holder" },
  { value: "DISSIPADOR", label: "Dissipador" },
  { value: "DRIVER_ONOFF_220", label: "Driver ON/OFF 220Vac" },
  { value: "DRIVER_ONOFF_BIVOLT", label: "Driver ON/OFF Bivolt" },
  { value: "DRIVER_DIM_110V", label: "Driver DIM 1-10V" },
  { value: "DRIVER_DIM_DALI", label: "Driver DIM DALI" },
  { value: "DRIVER_DIM_TRIAC_110V", label: "Driver DIM Triac 110V" },
  { value: "DRIVER_DIM_TRIAC_220V", label: "Driver DIM Triac 220V" },
] as const;

type ComponentType = typeof COMPONENT_TYPES[number]["value"];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// Autocomplete input that fetches suggestions from components table
function ComponentAutocomplete({
  tipo,
  value,
  onChange,
  placeholder,
}: {
  tipo: ComponentType;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const { data: suggestions = [] } = trpc.components.searchByTipo.useQuery(
    { tipo, query: inputVal },
    { enabled: inputVal.length >= 1 }
  );

  useEffect(() => { setInputVal(value); }, [value]);

  useEffect(() => {
    if (open && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    }
  }, [open, inputVal]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        className="input-dark text-sm"
        value={inputVal}
        placeholder={placeholder}
        onChange={(e) => {
          setInputVal(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => { if (inputVal.length >= 1) setOpen(true); }}
      />
      {open && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="bg-popover border border-border rounded-md shadow-lg overflow-y-auto max-h-48"
        >
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                setInputVal(s);
                onChange(s);
                setOpen(false);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function BulkReplaceComponentModal({ open, onClose, onSuccess }: Props) {
  const [tipo, setTipo] = useState<ComponentType>("MODULO_LED");
  const [componenteAtual, setComponenteAtual] = useState("");
  const [novoComponente, setNovoComponente] = useState("");
  const [familia, setFamilia] = useState("");
  const [confirming, setConfirming] = useState(false);

  const utils = trpc.useUtils();

  // Families list
  const { data: families = [] } = trpc.bulkOps.families.useQuery();

  // Preview query — only runs when componenteAtual has content
  const { data: preview, isFetching: previewLoading } = trpc.bulkOps.previewReplaceComponent.useQuery(
    { tipo, componenteAtual, familia: familia || undefined },
    { enabled: componenteAtual.trim().length >= 2 }
  );

  const applyMutation = trpc.bulkOps.applyReplaceComponent.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.updated} produto(s) atualizado(s) com sucesso!`);
      utils.products.list.invalidate();
      utils.components.list.invalidate();
      setConfirming(false);
      onSuccess?.();
      handleClose();
    },
    onError: (err) => {
      toast.error("Erro ao substituir: " + err.message);
      setConfirming(false);
    },
  });

  const handleClose = () => {
    setTipo("MODULO_LED");
    setComponenteAtual("");
    setNovoComponente("");
    setFamilia("");
    setConfirming(false);
    onClose();
  };

  const canApply = componenteAtual.trim().length >= 2 && novoComponente.trim().length >= 2 && (preview?.count ?? 0) > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Alteração em Massa de Componente</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Substitua um componente em todos os produtos que o utilizam, com opção de filtrar por família.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Tipo de Componente */}
            <div className="space-y-1.5">
              <Label className="field-label">Tipo de Componente <span className="text-destructive">*</span></Label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v as ComponentType); setComponenteAtual(""); setNovoComponente(""); }}>
                <SelectTrigger className="input-dark">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPONENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Componente Atual */}
            <div className="space-y-1.5">
              <Label className="field-label">Componente Atual (a substituir) <span className="text-destructive">*</span></Label>
              <ComponentAutocomplete
                tipo={tipo}
                value={componenteAtual}
                onChange={setComponenteAtual}
                placeholder="Digite para buscar componentes cadastrados..."
              />
              {componenteAtual.trim().length >= 2 && !previewLoading && (
                <p className="text-xs text-muted-foreground">
                  {preview?.count === 0
                    ? "Nenhum produto encontrado com este componente"
                    : preview
                    ? `${preview.count} produto(s) utilizam este componente`
                    : null}
                </p>
              )}
            </div>

            {/* Novo Componente */}
            <div className="space-y-1.5">
              <Label className="field-label">Novo Componente <span className="text-destructive">*</span></Label>
              <ComponentAutocomplete
                tipo={tipo}
                value={novoComponente}
                onChange={setNovoComponente}
                placeholder="Digite ou selecione o componente substituto..."
              />
            </div>

            {/* Filtrar por Família */}
            <div className="space-y-1.5">
              <Label className="field-label">
                Filtrar por Família{" "}
                <span className="text-muted-foreground font-normal text-xs">(opcional — deixe em branco para alterar em todos)</span>
              </Label>
              <Select value={familia || "__all__"} onValueChange={(v) => setFamilia(v === "__all__" ? "" : v)}>
                <SelectTrigger className="input-dark">
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

            {/* Preview table */}
            {componenteAtual.trim().length >= 2 && preview && preview.count > 0 && (
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <div className="bg-muted/30 px-3 py-2 flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium">
                    Prévia — {preview.count} produto(s) serão afetados
                    {preview.count > 20 ? ` (mostrando primeiros 20)` : ""}
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/20">
                      <tr>
                        <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Família</th>
                        <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Produto</th>
                        <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">SKU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.produtos.map((p: any, i: number) => (
                        <tr key={p.id ?? i} className="border-t border-border/30 hover:bg-muted/10">
                          <td className="px-3 py-1.5 text-muted-foreground">{p.familia}</td>
                          <td className="px-3 py-1.5 text-foreground">{p.produto}</td>
                          <td className="px-3 py-1.5 text-muted-foreground font-mono">{p.sku}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Warning */}
            {componenteAtual.trim() && novoComponente.trim() && componenteAtual === novoComponente && (
              <div className="flex items-center gap-2 text-amber-400 text-xs">
                <AlertCircle className="w-3.5 h-3.5" />
                O componente atual e o novo são iguais — nenhuma alteração será feita.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border/40">
            <Button variant="outline" onClick={handleClose} className="bg-transparent">
              Cancelar
            </Button>
            <Button
              disabled={!canApply || componenteAtual === novoComponente || applyMutation.isPending}
              onClick={() => setConfirming(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Substituir em {preview?.count ?? 0} produto(s)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmar Substituição em Massa</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Você está prestes a substituir <strong className="text-foreground">"{componenteAtual}"</strong> por{" "}
              <strong className="text-foreground">"{novoComponente}"</strong> em{" "}
              <strong className="text-foreground">{preview?.count} produto(s)</strong>
              {familia ? ` da família ${familia}` : " de todas as famílias"}.
              <br /><br />
              Esta ação não pode ser desfeita automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => applyMutation.mutate({ tipo, componenteAtual, novoComponente, familia: familia || undefined })}
            >
              Confirmar Substituição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
