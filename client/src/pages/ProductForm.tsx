import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AutocompleteInput } from "@/components/AutocompleteInput";
import { ComponentSelect } from "@/components/ComponentSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  DollarSign,
  Cpu,
  Settings,
  Tag,
  Thermometer,
  ArrowLeft,
  Save,
  Copy,
  PlusCircle,
  Trash2,
} from "lucide-react";

// ─── Sub-components (defined OUTSIDE ProductForm to prevent remount on every render) ───

interface FieldWrapperProps {
  field?: keyof FormData;
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  touched?: Partial<Record<keyof FormData, boolean>>;
  errors?: Partial<Record<keyof FormData, string>>;
}

const FieldWrapper = ({ field, label, required, children, className, touched, errors }: FieldWrapperProps) => {
  const hasError = field && touched?.[field] && errors?.[field];
  return (
    <div className={cn("space-y-1.5", hasError && "field-error", className)}>
      <Label className="field-label">
        {label}
        {required && <span className="required-star">*</span>}
      </Label>
      {children}
      {hasError && (
        <p className="field-error-msg">
          <AlertCircle className="w-3 h-3" />
          {errors![field!]}
        </p>
      )}
    </div>
  );
};

interface DriverRowProps {
  driverField: keyof FormData;
  custoField: keyof FormData;
  qtdField: keyof FormData;
  mkpPadraoDriverField?: keyof FormData;
  naoAplicavelField?: keyof FormData;
  label: string;
  required?: boolean;
  placeholder: string;
  optional?: boolean;
  form: FormData;
  touched: Partial<Record<keyof FormData, boolean>>;
  errors: Partial<Record<keyof FormData, string>>;
  setField: (field: keyof FormData, value: any) => void;
  setForm: React.Dispatch<React.SetStateAction<FormData>>;
  setErrors: React.Dispatch<React.SetStateAction<Partial<Record<keyof FormData, string>>>>;
  setTouched: React.Dispatch<React.SetStateAction<Partial<Record<keyof FormData, boolean>>>>;
}

const driverTypeMap: Record<string, "DRIVER_ONOFF_220" | "DRIVER_ONOFF_BIVOLT" | "DRIVER_DIM_110V" | "DRIVER_DIM_DALI" | "DRIVER_DIM_TRIAC_110V" | "DRIVER_DIM_TRIAC_220V"> = {
  driverOnoff220: "DRIVER_ONOFF_220",
  driverOnoffBivolt: "DRIVER_ONOFF_BIVOLT",
  driverDim110v: "DRIVER_DIM_110V",
  driverDimDali: "DRIVER_DIM_DALI",
  driverDimTriac110v: "DRIVER_DIM_TRIAC_110V",
  driverDimTriac220v: "DRIVER_DIM_TRIAC_220V",
};

const DriverRow = ({
  driverField, custoField, qtdField, mkpPadraoDriverField, naoAplicavelField, label, required, placeholder, optional,
  form, touched, errors, setField, setForm, setErrors, setTouched,
}: DriverRowProps) => {
  const isNaoAplicavel = naoAplicavelField ? !!form[naoAplicavelField] : false;
  const hasError = !isNaoAplicavel && touched[driverField] && errors[driverField];
  const componentTipo = driverTypeMap[driverField as string];
  return (
    <div className={cn("space-y-1.5", hasError && "field-error")}>
      <div className="flex items-center gap-2">
        <Label className="field-label flex-1">
          {label}
          {required && !isNaoAplicavel && <span className="required-star">*</span>}
        </Label>
        {naoAplicavelField && (
          <div className="flex items-center gap-1.5">
            <Checkbox
              id={`${String(driverField)}-na`}
              checked={isNaoAplicavel}
              onCheckedChange={(v) => {
                const checked = !!v;
                setForm((prev) => ({
                  ...prev,
                  [naoAplicavelField]: checked,
                  [driverField]: checked ? "NÃO APLICÁVEL" : "",
                }));
                setErrors((p) => ({ ...p, [driverField]: undefined }));
                setTouched((p) => ({ ...p, [driverField]: false }));
              }}
              className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary w-3.5 h-3.5"
            />
            <label
              htmlFor={`${String(driverField)}-na`}
              className="text-[10px] text-muted-foreground cursor-pointer select-none whitespace-nowrap"
            >
              NÃO APLICÁVEL
            </label>
          </div>
        )}
        {optional && !naoAplicavelField && (
          <span className="text-[10px] text-muted-foreground/60 font-medium tracking-wider">OPCIONAL</span>
        )}
      </div>
      {isNaoAplicavel ? (
        <Input className="input-dark opacity-50" value="NÃO APLICÁVEL" disabled readOnly />
      ) : (
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            {componentTipo ? (
              <ComponentSelect
                tipo={componentTipo}
                value={form[driverField] as string}
                onChange={(v) => {
                  setField(driverField, v);
                  setTouched((p) => ({ ...p, [driverField]: true }));
                }}
                onSelectComponent={(comp) => {
                  // Preenche o markup do driver automaticamente
                  if (mkpPadraoDriverField && comp.mkpPadraoDriver) {
                    setField(mkpPadraoDriverField, comp.mkpPadraoDriver);
                  }
                  // Preenche o custo do driver automaticamente
                  if (comp.custoDriver) {
                    setField(custoField, comp.custoDriver);
                  }
                }}
                onBlur={() => setTouched((p) => ({ ...p, [driverField]: true }))}
                placeholder={placeholder}
                hasError={!!hasError}
              />
            ) : (
              <AutocompleteInput
                field={driverField as any}
                value={form[driverField] as string}
                onChange={(v) => {
                  setField(driverField, v);
                  setTouched((p) => ({ ...p, [driverField]: true }));
                }}
                onBlur={() => setTouched((p) => ({ ...p, [driverField]: true }))}
                placeholder={placeholder}
                hasError={!!hasError}
              />
            )}
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="relative w-16">
                <Input
                  className="input-dark text-sm text-center px-2"
                  type="number"
                  min="1"
                  max="99"
                  step="1"
                  value={form[qtdField] as number ?? 1}
                  onChange={(e) => setField(qtdField, Math.max(1, parseInt(e.target.value) || 1))}
                  title="Quantidade de drivers por produto"
                />
                <span className="absolute -top-4 left-0 right-0 text-center text-[9px] text-muted-foreground/50 uppercase tracking-wider whitespace-nowrap">Qtd</span>
              </div>
              <div className="relative w-28">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium pointer-events-none z-10">
                  R$
                </span>
                <Input
                  className="input-dark pl-7 text-sm"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form[custoField] as string}
                  onChange={(e) => setField(custoField, e.target.value)}
                  placeholder="Custo"
                  title="Custo unitário deste driver (R$)"
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {hasError && (
        <p className="field-error-msg">
          <AlertCircle className="w-3 h-3" />
          {errors[driverField]}
        </p>
      )}
    </div>
  );
};

// ─── DriverExtraRow component ───────────────────────────────────────────────────

interface DriverExtraRowProps {
  tipo: "DRIVER_ONOFF_220" | "DRIVER_ONOFF_BIVOLT" | "DRIVER_DIM_110V" | "DRIVER_DIM_DALI" | "DRIVER_DIM_TRIAC_110V" | "DRIVER_DIM_TRIAC_220V";
  item: { modelo: string; qtd: number; custo: string };
  onChange: (updated: { modelo: string; qtd: number; custo: string }) => void;
  onRemove: () => void;
}

const DriverExtraRow = ({ tipo, item, onChange, onRemove }: DriverExtraRowProps) => (
  <div className="flex gap-2 items-start pl-3 border-l-2 border-primary/30">
    <div className="flex-1">
      <ComponentSelect
        tipo={tipo}
        value={item.modelo}
        onChange={(v) => onChange({ ...item, modelo: v })}
        placeholder="Selecione o driver adicional..."
      />
    </div>
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <div className="relative w-16">
        <Input
          className="input-dark text-sm text-center px-2"
          type="number" min="1" max="99" step="1"
          value={item.qtd}
          onChange={(e) => onChange({ ...item, qtd: Math.max(1, parseInt(e.target.value) || 1) })}
          title="Quantidade"
        />
        <span className="absolute -top-4 left-0 right-0 text-center text-[9px] text-muted-foreground/50 uppercase tracking-wider whitespace-nowrap">Qtd</span>
      </div>
      <div className="relative w-28">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium pointer-events-none z-10">R$</span>
        <Input
          className="input-dark pl-7 text-sm"
          type="number" step="0.01" min="0"
          value={item.custo}
          onChange={(e) => onChange({ ...item, custo: e.target.value })}
          placeholder="Custo"
          title="Custo unitário (R$)"
        />
      </div>
      <button type="button" onClick={onRemove}
        className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
        title="Remover driver">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

// ─── Driver extra types ─────────────────────────────────────────────────────

interface DriverExtra {
  modelo: string;
  qtd: number;
  custo: string;
}

type DriversExtraState = {
  onoff220: DriverExtra[];
  onoffBivolt: DriverExtra[];
  dim110v: DriverExtra[];
  dimDali: DriverExtra[];
  dimTriac110v: DriverExtra[];
  dimTriac220v: DriverExtra[];
};

const emptyDriverExtra = (): DriverExtra => ({ modelo: "", qtd: 1, custo: "" });

const defaultDriversExtra: DriversExtraState = {
  onoff220: [],
  onoffBivolt: [],
  dim110v: [],
  dimDali: [],
  dimTriac110v: [],
  dimTriac220v: [],
};

// ─── Otica extra types ───────────────────────────────────────────────────────

interface OticaExtra {
  modelo: string;
  qtd: number;
}

const emptyOticaExtra = (): OticaExtra => ({ modelo: "", qtd: 1 });

// ─── OticaExtraRow component ─────────────────────────────────────────────────

interface OticaExtraRowProps {
  index: number;
  item: OticaExtra;
  onChange: (updated: OticaExtra) => void;
  onRemove: () => void;
}

const OticaExtraRow = ({ index, item, onChange, onRemove }: OticaExtraRowProps) => (
  <div className="flex gap-3 items-center pl-3 border-l-2 border-primary/30 mt-2">
    <div className="flex-shrink-0 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium w-16 text-right">
      {index === 0 ? "SECUNDÁRIA" : `EXTRA ${index + 1}`}
    </div>
    <div className="flex-1 min-w-0">
      <ComponentSelect
        tipo="OTICA"
        value={item.modelo}
        onChange={(v) => onChange({ ...item, modelo: v })}
        placeholder="Selecione a ótica adicional..."
      />
    </div>
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">QTD</span>
      <Input
        className="input-dark text-sm text-center px-2 w-16"
        type="number" min="1" max="99" step="1"
        value={item.qtd}
        onChange={(e) => onChange({ ...item, qtd: Math.max(1, parseInt(e.target.value) || 1) })}
        title="Quantidade"
      />
    </div>
    <button type="button" onClick={onRemove}
      className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
      title="Remover ótica">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
);

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIAS = ["PERFIS", "DOWNLIGHTS", "PAINÉIS", "SPOTS", "ARANDELAS", "ÁREA EXTERNA", "BALIZADORES", "DECORATIVAS"];
const INSTALACOES = ["EMBUTIR", "SOBREPOR", "PENDENTE", "ARANDELA", "NO FRAME"];
const TEMPERATURAS = ["2700", "3000", "4000", "5000"];

interface FormData {
  categoria: string;
  instalacao: string;
  familia: string;
  sku: string;
  produto: string;
  moduloLed: string;
  qtdModuloLed: number;
  // Módulo LED por CCT
  moduloLed2700: string;
  moduloLed3000: string;
  moduloLed4000: string;
  moduloLed5000: string;
  qtdModuloLed2700: number;
  qtdModuloLed3000: number;
  qtdModuloLed4000: number;
  qtdModuloLed5000: number;
  otica: string;
  qtdOtica: number;
  oticaNaoAplicavel: boolean;
  holder: string;
  qtdHolder: number;
  holderNaoAplicavel: boolean;
  dissipador: string;
  qtdDissipador: number;
  dissipadorNaoAplicavel: boolean;
  semDriver: boolean;
  driverOnoff220: string;
  qtdDriverOnoff220: number;
  custoDriverOnoff220: string;
  driverOnoffBivolt: string;
  qtdDriverOnoffBivolt: number;
  driverOnoffBivoltNaoAplicavel: boolean;
  custoDriverOnoffBivolt: string;
  driverDim110v: string;
  qtdDriverDim110v: number;
  driverDim110vNaoAplicavel: boolean;
  custoDriverDim110v: string;
  driverDimDali: string;
  qtdDriverDimDali: number;
  driverDimDaliNaoAplicavel: boolean;
  custoDriverDimDali: string;
  driverDimTriac110v: string;
  qtdDriverDimTriac110v: number;
  driverDimTriac110vNaoAplicavel: boolean;
  custoDriverDimTriac110v: string;
  driverDimTriac220v: string;
  qtdDriverDimTriac220v: number;
  driverDimTriac220vNaoAplicavel: boolean;
  custoDriverDimTriac220v: string;
  temperaturasCor: string[];
  fotoUrl: string;
  fotoKey: string;
  custoLuminaria: string;
  // Custo do corpo por tipo de driver
  custoCorpoOnoff220v: string;
  custoCorpoOnoffBivolt: string;
  custoCorpoDim110v: string;
  custoCorpoDimDali: string;
  custoCorpoDimTriac110v: string;
  custoCorpoDimTriac220v: string;
  // Markup padrão por tipo de driver
  mkpPadraoOnoff220v: string;
  mkpPadraoOnoffBivolt: string;
  mkpPadraoDim110v: string;
  mkpPadraoDimDali: string;
  mkpPadraoDimTriac110v: string;
  mkpPadraoDimTriac220v: string;
  // Markup mínimo por tipo de driver
  mkpMinimoOnoff220v: string;
  mkpMinimoOnoffBivolt: string;
  mkpMinimoDim110v: string;
  mkpMinimoDimDali: string;
  mkpMinimoDimTriac110v: string;
  mkpMinimoDimTriac220v: string;
  // Markup do driver por tipo (preenchido automaticamente ao selecionar o driver)
  mkpPadraoDriverOnoff220v: string;
  mkpPadraoDriverOnoffBivolt: string;
  mkpPadraoDriverDim110v: string;
  mkpPadraoDriverDimDali: string;
  mkpPadraoDriverDimTriac110v: string;
  mkpPadraoDriverDimTriac220v: string;
  // Custo D1+D2 (apenas PERFIS)
  custoCorpoOnoff220vD1D2: string;
  custoCorpoOnoffBivoltD1D2: string;
  custoCorpoDim110vD1D2: string;
  custoCorpoDimDaliD1D2: string;
  custoCorpoDimTriac110vD1D2: string;
  custoCorpoDimTriac220vD1D2: string;
  precoVendaOnoff220: string;
  precoVendaOnoffBivolt: string;
  precoVendaDim110v: string;
  precoVendaDimDali: string;
  // Configuração de planos (exclusivo para PERFIS)
  configuracaoPlanos: "D1" | "D2" | "D1+D2" | "";
  // Preço D1/D1+D2 (perfis com dois planos)
  precoVendaOnoff220D1: string;
  precoVendaOnoff220D1D2: string;
  precoVendaOnoffBivoltD1: string;
  precoVendaOnoffBivoltD1D2: string;
  precoVendaDim110vD1: string;
  precoVendaDim110vD1D2: string;
  precoVendaDimDaliD1: string;
  precoVendaDimDaliD1D2: string;
}

const defaultForm: FormData = {
  categoria: "",
  instalacao: "",
  familia: "",
  sku: "",
  produto: "",
  moduloLed: "",
  qtdModuloLed: 1,
  // Módulo LED por CCT
  moduloLed2700: "",
  moduloLed3000: "",
  moduloLed4000: "",
  moduloLed5000: "",
  qtdModuloLed2700: 1,
  qtdModuloLed3000: 1,
  qtdModuloLed4000: 1,
  qtdModuloLed5000: 1,
  otica: "",
  qtdOtica: 1,
  oticaNaoAplicavel: false,
  holder: "",
  qtdHolder: 1,
  holderNaoAplicavel: false,
  dissipador: "",
  qtdDissipador: 1,
  dissipadorNaoAplicavel: false,
  semDriver: false,
  driverOnoff220: "",
  qtdDriverOnoff220: 1,
  custoDriverOnoff220: "",
  driverOnoffBivolt: "",
  qtdDriverOnoffBivolt: 1,
  driverOnoffBivoltNaoAplicavel: false,
  custoDriverOnoffBivolt: "",
  driverDim110v: "",
  qtdDriverDim110v: 1,
  driverDim110vNaoAplicavel: false,
  custoDriverDim110v: "",
  driverDimDali: "",
  qtdDriverDimDali: 1,
  driverDimDaliNaoAplicavel: false,
  custoDriverDimDali: "",
  driverDimTriac110v: "",
  qtdDriverDimTriac110v: 1,
  driverDimTriac110vNaoAplicavel: false,
  custoDriverDimTriac110v: "",
  driverDimTriac220v: "",
  qtdDriverDimTriac220v: 1,
  driverDimTriac220vNaoAplicavel: false,
  custoDriverDimTriac220v: "",
  temperaturasCor: ["2700", "3000", "4000", "5000"],
  fotoUrl: "",
  fotoKey: "",
  custoLuminaria: "",
  // Custo do corpo por tipo de driver
  custoCorpoOnoff220v: "",
  custoCorpoOnoffBivolt: "",
  custoCorpoDim110v: "",
  custoCorpoDimDali: "",
  custoCorpoDimTriac110v: "",
  custoCorpoDimTriac220v: "",
  // Markup padrão por tipo de driver
  mkpPadraoOnoff220v: "",
  mkpPadraoOnoffBivolt: "",
  mkpPadraoDim110v: "",
  mkpPadraoDimDali: "",
  mkpPadraoDimTriac110v: "",
  mkpPadraoDimTriac220v: "",
  // Markup mínimo por tipo de driver
  mkpMinimoOnoff220v: "",
  mkpMinimoOnoffBivolt: "",
  mkpMinimoDim110v: "",
  mkpMinimoDimDali: "",
  mkpMinimoDimTriac110v: "",
  mkpMinimoDimTriac220v: "",
  // Markup do driver por tipo (preenchido automaticamente ao selecionar o driver)
  mkpPadraoDriverOnoff220v: "",
  mkpPadraoDriverOnoffBivolt: "",
  mkpPadraoDriverDim110v: "",
  mkpPadraoDriverDimDali: "",
  mkpPadraoDriverDimTriac110v: "",
  mkpPadraoDriverDimTriac220v: "",
  custoCorpoOnoff220vD1D2: "",
  custoCorpoOnoffBivoltD1D2: "",
  custoCorpoDim110vD1D2: "",
  custoCorpoDimDaliD1D2: "",
  custoCorpoDimTriac110vD1D2: "",
  custoCorpoDimTriac220vD1D2: "",
  precoVendaOnoff220: "",
  precoVendaOnoffBivolt: "",
  precoVendaDim110v: "",
  precoVendaDimDali: "",
  configuracaoPlanos: "",
  precoVendaOnoff220D1: "",
  precoVendaOnoff220D1D2: "",
  precoVendaOnoffBivoltD1: "",
  precoVendaOnoffBivoltD1D2: "",
  precoVendaDim110vD1: "",
  precoVendaDim110vD1D2: "",
  precoVendaDimDaliD1: "",
  precoVendaDimDaliD1D2: "",
};

// Required fields (driverOnoffBivolt is conditional — required only if not NaoAplicavel)
const REQUIRED_FIELDS: (keyof FormData)[] = [
  "instalacao", "familia", "produto",
  "otica", "holder", "dissipador",
];

const FIELD_LABELS: Record<string, string> = {
  instalacao: "INSTALAÇÃO",
  familia: "FAMÍLIA",
  sku: "SKU",
  produto: "PRODUTO",
  moduloLed: "MÓDULO LED",
  otica: "ÓTICA MÓDULO LED",
  holder: "HOLDER",
  dissipador: "DISSIPADOR",
};

interface ProductFormProps {
  editId?: number;
  duplicarDeId?: number;
  onSuccess?: () => void;
}

export default function ProductForm({ editId, duplicarDeId, onSuccess }: ProductFormProps) {
  const [, navigate] = useLocation();
  const [form, setForm] = useState<FormData>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [produtoOriginalNome, setProdutoOriginalNome] = useState<string | null>(null);
  const [driversExtra, setDriversExtra] = useState<DriversExtraState>(defaultDriversExtra);
  const [oticasExtra, setOticasExtra] = useState<OticaExtra[]>([]);
  const [showSemDriverDialog, setShowSemDriverDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Keep a ref that always points to the latest form state so validate()
  // never reads a stale closure value
  const formRef = useRef<FormData>(form);
  useEffect(() => { formRef.current = form; }, [form]);
  const isEdit = !!editId;
  const isDuplicate = !!duplicarDeId;

  // Load existing product for edit OR for duplication
  const loadId = editId ?? duplicarDeId;
  const { data: existingProduct } = trpc.products.getById.useQuery(
    { id: loadId! },
    { enabled: !!loadId }
  );

  useEffect(() => {
    if (existingProduct) {
      const temps = (() => {
        try { return JSON.parse(existingProduct.temperaturasCor || "[]"); }
        catch { return ["2700", "3000", "4000", "5000"]; }
      })();
      const p = existingProduct as any;
      const baseForm = {
        categoria: existingProduct.categoria || "",
        instalacao: existingProduct.instalacao || "",
        familia: existingProduct.familia || "",
        sku: existingProduct.sku || "",
        produto: existingProduct.produto || "",
        moduloLed: existingProduct.moduloLed || "",
        qtdModuloLed: (p.qtdModuloLed != null ? Number(p.qtdModuloLed) : 1),
        // Módulo LED por CCT
        moduloLed2700: p.moduloLed2700 || "",
        moduloLed3000: p.moduloLed3000 || "",
        moduloLed4000: p.moduloLed4000 || "",
        moduloLed5000: p.moduloLed5000 || "",
        qtdModuloLed2700: (p.qtdModuloLed2700 != null ? Number(p.qtdModuloLed2700) : 1),
        qtdModuloLed3000: (p.qtdModuloLed3000 != null ? Number(p.qtdModuloLed3000) : 1),
        qtdModuloLed4000: (p.qtdModuloLed4000 != null ? Number(p.qtdModuloLed4000) : 1),
        qtdModuloLed5000: (p.qtdModuloLed5000 != null ? Number(p.qtdModuloLed5000) : 1),
        // Se o campo está vazio no banco (sem valor e sem flag naoAplicavel), trata como naoAplicavel=true
        // para evitar que o formulário fique bloqueado por campos obrigatórios vazios
        otica: (existingProduct.oticaNaoAplicavel || !existingProduct.otica) ? "" : existingProduct.otica,
        qtdOtica: (p.qtdOtica != null ? Number(p.qtdOtica) : 1),
        oticaNaoAplicavel: existingProduct.oticaNaoAplicavel || !existingProduct.otica || false,
        holder: (existingProduct.holderNaoAplicavel || !existingProduct.holder) ? "" : existingProduct.holder,
        qtdHolder: (p.qtdHolder != null ? Number(p.qtdHolder) : 1),
        holderNaoAplicavel: existingProduct.holderNaoAplicavel || !existingProduct.holder || false,
        dissipador: (existingProduct.dissipadorNaoAplicavel || !existingProduct.dissipador) ? "" : existingProduct.dissipador,
        qtdDissipador: (p.qtdDissipador != null ? Number(p.qtdDissipador) : 1),
        dissipadorNaoAplicavel: existingProduct.dissipadorNaoAplicavel || !existingProduct.dissipador || false,
        semDriver: Boolean((p as any).semDriver),
        driverOnoff220: existingProduct.driverOnoff220 || "",
        qtdDriverOnoff220: (p.qtdDriverOnoff220 != null ? Number(p.qtdDriverOnoff220) : 1),
        custoDriverOnoff220: p.custoDriverOnoff220 ? String(p.custoDriverOnoff220) : "",
        driverOnoffBivolt: existingProduct.driverOnoffBivoltNaoAplicavel ? "" : (existingProduct.driverOnoffBivolt || ""),
        qtdDriverOnoffBivolt: (p.qtdDriverOnoffBivolt != null ? Number(p.qtdDriverOnoffBivolt) : 1),
        driverOnoffBivoltNaoAplicavel: existingProduct.driverOnoffBivoltNaoAplicavel || false,
        custoDriverOnoffBivolt: p.custoDriverOnoffBivolt ? String(p.custoDriverOnoffBivolt) : "",
        driverDim110v: existingProduct.driverDim110vNaoAplicavel ? "" : (existingProduct.driverDim110v || ""),
        qtdDriverDim110v: (p.qtdDriverDim110v != null ? Number(p.qtdDriverDim110v) : 1),
        driverDim110vNaoAplicavel: existingProduct.driverDim110vNaoAplicavel || false,
        custoDriverDim110v: p.custoDriverDim110v ? String(p.custoDriverDim110v) : "",
        driverDimDali: existingProduct.driverDimDaliNaoAplicavel ? "" : (existingProduct.driverDimDali || ""),
        qtdDriverDimDali: (p.qtdDriverDimDali != null ? Number(p.qtdDriverDimDali) : 1),
        driverDimDaliNaoAplicavel: existingProduct.driverDimDaliNaoAplicavel || false,
        custoDriverDimDali: p.custoDriverDimDali ? String(p.custoDriverDimDali) : "",
        driverDimTriac110v: (p as any).driverDimTriac110vNaoAplicavel ? "" : ((p as any).driverDimTriac110v || ""),
        qtdDriverDimTriac110v: ((p as any).qtdDriverDimTriac110v != null ? Number((p as any).qtdDriverDimTriac110v) : 1),
        driverDimTriac110vNaoAplicavel: (p as any).driverDimTriac110vNaoAplicavel || false,
        custoDriverDimTriac110v: (p as any).custoDriverDimTriac110v ? String((p as any).custoDriverDimTriac110v) : "",
        driverDimTriac220v: (p as any).driverDimTriac220vNaoAplicavel ? "" : ((p as any).driverDimTriac220v || ""),
        qtdDriverDimTriac220v: ((p as any).qtdDriverDimTriac220v != null ? Number((p as any).qtdDriverDimTriac220v) : 1),
        driverDimTriac220vNaoAplicavel: (p as any).driverDimTriac220vNaoAplicavel || false,
        custoDriverDimTriac220v: (p as any).custoDriverDimTriac220v ? String((p as any).custoDriverDimTriac220v) : "",
        temperaturasCor: temps,
        fotoUrl: existingProduct.fotoUrl || "",
        fotoKey: existingProduct.fotoKey || "",
        custoLuminaria: existingProduct.custoLuminaria ? String(existingProduct.custoLuminaria) : "",
        // Custo do corpo por tipo de driver
        custoCorpoOnoff220v: p.custoCorpoOnoff220v ? String(p.custoCorpoOnoff220v) : "",
        custoCorpoOnoffBivolt: p.custoCorpoOnoffBivolt ? String(p.custoCorpoOnoffBivolt) : "",
        custoCorpoDim110v: p.custoCorpoDim110v ? String(p.custoCorpoDim110v) : "",
        custoCorpoDimDali: p.custoCorpoDimDali ? String(p.custoCorpoDimDali) : "",
        custoCorpoDimTriac110v: p.custoCorpoDimTriac110v ? String(p.custoCorpoDimTriac110v) : "",
        custoCorpoDimTriac220v: p.custoCorpoDimTriac220v ? String(p.custoCorpoDimTriac220v) : "",
        // Markup padrão por tipo de driver
        mkpPadraoOnoff220v: p.mkpPadraoOnoff220v ? String(p.mkpPadraoOnoff220v) : "",
        mkpPadraoOnoffBivolt: p.mkpPadraoOnoffBivolt ? String(p.mkpPadraoOnoffBivolt) : "",
        mkpPadraoDim110v: p.mkpPadraoDim110v ? String(p.mkpPadraoDim110v) : "",
        mkpPadraoDimDali: p.mkpPadraoDimDali ? String(p.mkpPadraoDimDali) : "",
        mkpPadraoDimTriac110v: p.mkpPadraoDimTriac110v ? String(p.mkpPadraoDimTriac110v) : "",
        mkpPadraoDimTriac220v: p.mkpPadraoDimTriac220v ? String(p.mkpPadraoDimTriac220v) : "",
        // Markup mínimo por tipo de driver
        mkpMinimoOnoff220v: p.mkpMinimoOnoff220v ? String(p.mkpMinimoOnoff220v) : "",
        mkpMinimoOnoffBivolt: p.mkpMinimoOnoffBivolt ? String(p.mkpMinimoOnoffBivolt) : "",
        mkpMinimoDim110v: p.mkpMinimoDim110v ? String(p.mkpMinimoDim110v) : "",
        mkpMinimoDimDali: p.mkpMinimoDimDali ? String(p.mkpMinimoDimDali) : "",
        mkpMinimoDimTriac110v: p.mkpMinimoDimTriac110v ? String(p.mkpMinimoDimTriac110v) : "",
        mkpMinimoDimTriac220v: p.mkpMinimoDimTriac220v ? String(p.mkpMinimoDimTriac220v) : "",
        custoCorpoOnoff220vD1D2: (p as any).custoCorpoOnoff220vD1D2 ? String((p as any).custoCorpoOnoff220vD1D2) : "",
        custoCorpoOnoffBivoltD1D2: (p as any).custoCorpoOnoffBivoltD1D2 ? String((p as any).custoCorpoOnoffBivoltD1D2) : "",
        custoCorpoDim110vD1D2: (p as any).custoCorpoDim110vD1D2 ? String((p as any).custoCorpoDim110vD1D2) : "",
        custoCorpoDimDaliD1D2: (p as any).custoCorpoDimDaliD1D2 ? String((p as any).custoCorpoDimDaliD1D2) : "",
        custoCorpoDimTriac110vD1D2: (p as any).custoCorpoDimTriac110vD1D2 ? String((p as any).custoCorpoDimTriac110vD1D2) : "",
        custoCorpoDimTriac220vD1D2: (p as any).custoCorpoDimTriac220vD1D2 ? String((p as any).custoCorpoDimTriac220vD1D2) : "",
        precoVendaOnoff220: p.precoVendaOnoff220 ? String(p.precoVendaOnoff220) : "",
        precoVendaOnoffBivolt: p.precoVendaOnoffBivolt ? String(p.precoVendaOnoffBivolt) : "",
        precoVendaDim110v: p.precoVendaDim110v ? String(p.precoVendaDim110v) : "",
        precoVendaDimDali: p.precoVendaDimDali ? String(p.precoVendaDimDali) : "",
        configuracaoPlanos: (p as any).configuracaoPlanos || "",
        precoVendaOnoff220D1: (p as any).precoVendaOnoff220D1 ? String((p as any).precoVendaOnoff220D1) : "",
        precoVendaOnoff220D1D2: (p as any).precoVendaOnoff220D1D2 ? String((p as any).precoVendaOnoff220D1D2) : "",
        precoVendaOnoffBivoltD1: (p as any).precoVendaOnoffBivoltD1 ? String((p as any).precoVendaOnoffBivoltD1) : "",
        precoVendaOnoffBivoltD1D2: (p as any).precoVendaOnoffBivoltD1D2 ? String((p as any).precoVendaOnoffBivoltD1D2) : "",
        precoVendaDim110vD1: (p as any).precoVendaDim110vD1 ? String((p as any).precoVendaDim110vD1) : "",
        precoVendaDim110vD1D2: (p as any).precoVendaDim110vD1D2 ? String((p as any).precoVendaDim110vD1D2) : "",
        precoVendaDimDaliD1: (p as any).precoVendaDimDaliD1 ? String((p as any).precoVendaDimDaliD1) : "",
        precoVendaDimDaliD1D2: (p as any).precoVendaDimDaliD1D2 ? String((p as any).precoVendaDimDaliD1D2) : "",
        // Markup do driver por tipo (salvo no banco)
        mkpPadraoDriverOnoff220v:    (p as any).mkpPadraoDriverOnoff220v    ? String((p as any).mkpPadraoDriverOnoff220v)    : "",
        mkpPadraoDriverOnoffBivolt:  (p as any).mkpPadraoDriverOnoffBivolt  ? String((p as any).mkpPadraoDriverOnoffBivolt)  : "",
        mkpPadraoDriverDim110v:      (p as any).mkpPadraoDriverDim110v      ? String((p as any).mkpPadraoDriverDim110v)      : "",
        mkpPadraoDriverDimDali:      (p as any).mkpPadraoDriverDimDali      ? String((p as any).mkpPadraoDriverDimDali)      : "",
        mkpPadraoDriverDimTriac110v: (p as any).mkpPadraoDriverDimTriac110v ? String((p as any).mkpPadraoDriverDimTriac110v) : "",
        mkpPadraoDriverDimTriac220v: (p as any).mkpPadraoDriverDimTriac220v ? String((p as any).mkpPadraoDriverDimTriac220v) : "",
      };

      // Carregar drivers extras do banco
      const parseExtra = (raw: string | null | undefined): DriverExtra[] => {
        if (!raw) return [];
        try { return JSON.parse(raw) as DriverExtra[]; } catch { return []; }
      };
      setDriversExtra({
        onoff220: parseExtra((p as any).driverOnoff220Extra),
        onoffBivolt: parseExtra((p as any).driverOnoffBivoltExtra),
        dim110v: parseExtra((p as any).driverDim110vExtra),
        dimDali: parseExtra((p as any).driverDimDaliExtra),
        dimTriac110v: parseExtra((p as any).driverDimTriac110vExtra),
        dimTriac220v: parseExtra((p as any).driverDimTriac220vExtra),
      });
      // Carregar óticas extras do banco
      const parseOticaExtra = (raw: string | null | undefined): OticaExtra[] => {
        if (!raw) return [];
        try { return JSON.parse(raw) as OticaExtra[]; } catch { return []; }
      };
      setOticasExtra(parseOticaExtra((p as any).oticaExtra));

      if (isDuplicate) {
        // When duplicating: keep SKU (same SKU can have multiple variants), clear only PRODUTO
        setProdutoOriginalNome(existingProduct.produto || existingProduct.sku || "produto");
        setForm({ ...baseForm, produto: "" });
        setPhotoPreview(existingProduct.fotoUrl || null);
      } else {
        setForm(baseForm);
        if (existingProduct.fotoUrl) setPhotoPreview(existingProduct.fotoUrl);
      }
    }
  }, [existingProduct, isDuplicate]);

  const utils = trpc.useUtils();
  const createMutation = trpc.products.create.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      utils.products.count.invalidate();
      toast.success("Produto cadastrado com sucesso!");
      if (onSuccess) onSuccess();
      else navigate("/");
    },
    onError: (err) => toast.error("Erro ao cadastrar: " + err.message),
  });

  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => {
      utils.products.list.invalidate();
      toast.success("Produto atualizado com sucesso!");
      if (onSuccess) onSuccess();
      else navigate("/");
    },
    onError: (err) => toast.error("Erro ao atualizar: " + err.message),
  });

  // ─── Validation ──────────────────────────────────────────────────────────

  // Always read from formRef.current so we never use a stale closure
  const validate = (): boolean => {
    const f = formRef.current;
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    for (const field of REQUIRED_FIELDS) {
      if (field === "otica" && f.oticaNaoAplicavel) continue;
      if (field === "holder" && f.holderNaoAplicavel) continue;
      if (field === "dissipador" && f.dissipadorNaoAplicavel) continue;
            if (field === "driverOnoffBivolt" && f.driverOnoffBivoltNaoAplicavel) continue;
      if ((field === "driverOnoff220" || field === "driverOnoffBivolt") && f.semDriver) continue;
      const value = f[field];
      if (!value || (typeof value === "string" && !value.trim())) {
        newErrors[field] = `${FIELD_LABELS[field]} é obrigatório`;
      }
    }

    setErrors(newErrors);
    const allTouched: Partial<Record<keyof FormData, boolean>> = {};
    REQUIRED_FIELDS.forEach((fld) => (allTouched[fld] = true));
    setTouched(allTouched);

    return Object.keys(newErrors).length === 0;
  };

  // isFormValid is called during render — must use `form` state directly (not formRef)
  // so the button re-enables as soon as the user fills required fields
  const isFormValid = (): boolean => {
    for (const field of REQUIRED_FIELDS) {
      if (field === "otica" && form.oticaNaoAplicavel) continue;
      if (field === "holder" && form.holderNaoAplicavel) continue;
      if (field === "dissipador" && form.dissipadorNaoAplicavel) continue;
      if (field === "driverOnoffBivolt" && form.driverOnoffBivoltNaoAplicavel) continue;
      if ((field === "driverOnoff220" || field === "driverOnoffBivolt") && form.semDriver) continue;
      const value = form[field];
      if (!value || (typeof value === "string" && !value.trim())) return false;
    }
    return true;
  };

  // ─── Handlers ────────────────────────────────────────────────────────────

  const setField = (field: keyof FormData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleTextUpper = (field: keyof FormData, value: string) => {
    setField(field, value.toUpperCase());
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const toggleTemp = (temp: string) => {
    setForm((prev) => ({
      ...prev,
      temperaturasCor: prev.temperaturasCor.includes(temp)
        ? prev.temperaturasCor.filter((t) => t !== temp)
        : [...prev.temperaturasCor, temp],
    }));
  };

  const handlePhotoUpload = async (file: File) => {
    if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
      toast.error("Formato inválido. Use JPEG, JPG ou PNG.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/products/upload-image", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        setForm((prev) => ({ ...prev, fotoUrl: data.url, fotoKey: data.key }));
        setPhotoPreview(data.url);
        // Limpa todos os errors residuais — isFormValid() já recalcula o estado atual
        setErrors({});
        toast.success("Foto enviada com sucesso!");
      }
    } catch {
      toast.error("Erro ao enviar foto");
    } finally {
      setUploading(false);
    }
  };

  const doSubmit = () => {
    // Sync ref before validating to ensure we read the absolute latest state
    formRef.current = form;
    if (!validate()) {
      toast.error("Preencha todos os campos obrigatórios");
      setTimeout(() => {
        const el = document.querySelector(".field-error");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      return;
    }

    // Derivar temperaturasCor automaticamente dos módulos CCT preenchidos
    const hasCctModules = !!(form.moduloLed2700 || form.moduloLed3000 || form.moduloLed4000 || form.moduloLed5000);
    const derivedTemps = hasCctModules
      ? [
          ...(form.moduloLed2700 ? ["2700"] : []),
          ...(form.moduloLed3000 ? ["3000"] : []),
          ...(form.moduloLed4000 ? ["4000"] : []),
          ...(form.moduloLed5000 ? ["5000"] : []),
        ]
      : form.temperaturasCor;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = {
      ...form,
      semDriver: form.semDriver,
      temperaturasCor: JSON.stringify(derivedTemps),
      moduloLed2700: form.moduloLed2700 || undefined,
      moduloLed3000: form.moduloLed3000 || undefined,
      moduloLed4000: form.moduloLed4000 || undefined,
      moduloLed5000: form.moduloLed5000 || undefined,
      qtdModuloLed2700: form.moduloLed2700 ? form.qtdModuloLed2700 : undefined,
      qtdModuloLed3000: form.moduloLed3000 ? form.qtdModuloLed3000 : undefined,
      qtdModuloLed4000: form.moduloLed4000 ? form.qtdModuloLed4000 : undefined,
      qtdModuloLed5000: form.moduloLed5000 ? form.qtdModuloLed5000 : undefined,
      custoLuminaria: form.custoLuminaria || undefined,
      // Custo do corpo por tipo de driver
      custoCorpoOnoff220v: form.custoCorpoOnoff220v || undefined,
      custoCorpoOnoffBivolt: form.custoCorpoOnoffBivolt || undefined,
      custoCorpoDim110v: form.custoCorpoDim110v || undefined,
      custoCorpoDimDali: form.custoCorpoDimDali || undefined,
      custoCorpoDimTriac110v: form.custoCorpoDimTriac110v || undefined,
      custoCorpoDimTriac220v: form.custoCorpoDimTriac220v || undefined,
      // Markup padrão por tipo de driver
      mkpPadraoOnoff220v: form.mkpPadraoOnoff220v || undefined,
      mkpPadraoOnoffBivolt: form.mkpPadraoOnoffBivolt || undefined,
      mkpPadraoDim110v: form.mkpPadraoDim110v || undefined,
      mkpPadraoDimDali: form.mkpPadraoDimDali || undefined,
      mkpPadraoDimTriac110v: form.mkpPadraoDimTriac110v || undefined,
      mkpPadraoDimTriac220v: form.mkpPadraoDimTriac220v || undefined,
      // Markup mínimo por tipo de driver
      mkpMinimoOnoff220v: form.mkpMinimoOnoff220v || undefined,
      mkpMinimoOnoffBivolt: form.mkpMinimoOnoffBivolt || undefined,
      mkpMinimoDim110v: form.mkpMinimoDim110v || undefined,
      mkpMinimoDimDali: form.mkpMinimoDimDali || undefined,
      mkpMinimoDimTriac110v: form.mkpMinimoDimTriac110v || undefined,
      mkpMinimoDimTriac220v: form.mkpMinimoDimTriac220v || undefined,
      custoCorpoOnoff220vD1D2: form.custoCorpoOnoff220vD1D2 || undefined,
      custoCorpoOnoffBivoltD1D2: form.custoCorpoOnoffBivoltD1D2 || undefined,
      custoCorpoDim110vD1D2: form.custoCorpoDim110vD1D2 || undefined,
      custoCorpoDimDaliD1D2: form.custoCorpoDimDaliD1D2 || undefined,
      custoCorpoDimTriac110vD1D2: form.custoCorpoDimTriac110vD1D2 || undefined,
      custoCorpoDimTriac220vD1D2: form.custoCorpoDimTriac220vD1D2 || undefined,
      custoDriverOnoff220: form.custoDriverOnoff220 || undefined,
      custoDriverOnoffBivolt: form.custoDriverOnoffBivolt || undefined,
      custoDriverDim110v: form.custoDriverDim110v || undefined,
      custoDriverDimDali: form.custoDriverDimDali || undefined,
      fotoUrl: form.fotoUrl || undefined,
      fotoKey: form.fotoKey || undefined,
      precoVendaOnoff220: form.precoVendaOnoff220 || undefined,
      precoVendaOnoffBivolt: form.precoVendaOnoffBivolt || undefined,
      precoVendaDim110v: form.precoVendaDim110v || undefined,
      precoVendaDimDali: form.precoVendaDimDali || undefined,
      configuracaoPlanos: (form.configuracaoPlanos as "D1" | "D2" | "D1+D2" | undefined) || undefined,
      precoVendaOnoff220D1:      form.precoVendaOnoff220D1      || undefined,
      precoVendaOnoff220D1D2:    form.precoVendaOnoff220D1D2    || undefined,
      precoVendaOnoffBivoltD1:   form.precoVendaOnoffBivoltD1   || undefined,
      precoVendaOnoffBivoltD1D2: form.precoVendaOnoffBivoltD1D2 || undefined,
      precoVendaDim110vD1:       form.precoVendaDim110vD1       || undefined,
      precoVendaDim110vD1D2:     form.precoVendaDim110vD1D2     || undefined,
      precoVendaDimDaliD1:       form.precoVendaDimDaliD1       || undefined,
      precoVendaDimDaliD1D2:     form.precoVendaDimDaliD1D2     || undefined,
      // Drivers ON/OFF
      driverOnoffBivolt: form.driverOnoffBivoltNaoAplicavel ? "NÃO APLICÁVEL" : (form.driverOnoffBivolt || undefined),
      // Drivers DIM: só envia se o usuário explicitamente marcou NÃO APLICÁVEL ou preencheu o campo.
      // Se ambos estão vazios/false, nÃo envia para não sobrescrever o estado do banco.
      driverDim110v: form.driverDim110vNaoAplicavel
        ? "NÃO APLICÁVEL"
        : (form.driverDim110v || undefined),
      driverDimDali: form.driverDimDaliNaoAplicavel
        ? "NÃO APLICÁVEL"
        : (form.driverDimDali || undefined),
      driverDimTriac110v: form.driverDimTriac110vNaoAplicavel
        ? "NÃO APLICÁVEL"
        : (form.driverDimTriac110v || undefined),
      driverDimTriac220v: form.driverDimTriac220vNaoAplicavel
        ? "NÃO APLICÁVEL"
        : (form.driverDimTriac220v || undefined),
      custoDriverDimTriac110v: form.custoDriverDimTriac110v || undefined,
      custoDriverDimTriac220v: form.custoDriverDimTriac220v || undefined,
      // Markup do driver por tipo (buscado do componente ao selecionar)
      mkpPadraoDriverOnoff220v:    form.mkpPadraoDriverOnoff220v    || undefined,
      mkpPadraoDriverOnoffBivolt:  form.mkpPadraoDriverOnoffBivolt  || undefined,
      mkpPadraoDriverDim110v:      form.mkpPadraoDriverDim110v      || undefined,
      mkpPadraoDriverDimDali:      form.mkpPadraoDriverDimDali      || undefined,
      mkpPadraoDriverDimTriac110v: form.mkpPadraoDriverDimTriac110v || undefined,
      mkpPadraoDriverDimTriac220v: form.mkpPadraoDriverDimTriac220v || undefined,
    };
    // Se os campos DIM estão vazios E não marcados como NÃO APLICÁVEL,
    // remove os campos NaoAplicavel do payload para não sobrescrever o banco com false
    if (!form.driverDim110vNaoAplicavel && !form.driverDim110v) {
      delete payload.driverDim110vNaoAplicavel;
      delete payload.driverDim110v;
    }
    if (!form.driverDimDaliNaoAplicavel && !form.driverDimDali) {
      delete payload.driverDimDaliNaoAplicavel;
      delete payload.driverDimDali;
    }
    if (!form.driverDimTriac110vNaoAplicavel && !form.driverDimTriac110v) {
      delete payload.driverDimTriac110vNaoAplicavel;
      delete payload.driverDimTriac110v;
    }
    if (!form.driverDimTriac220vNaoAplicavel && !form.driverDimTriac220v) {
      delete payload.driverDimTriac220vNaoAplicavel;
      delete payload.driverDimTriac220v;
    }

    // Serializar drivers extras como JSON
    const serializeExtra = (arr: DriverExtra[]) =>
      arr.length > 0 ? JSON.stringify(arr.filter((d) => d.modelo.trim())) : undefined;
    payload.driverOnoff220Extra = serializeExtra(driversExtra.onoff220);
    payload.driverOnoffBivoltExtra = serializeExtra(driversExtra.onoffBivolt);
    payload.driverDim110vExtra = serializeExtra(driversExtra.dim110v);
    payload.driverDimDaliExtra = serializeExtra(driversExtra.dimDali);
    payload.driverDimTriac110vExtra = serializeExtra(driversExtra.dimTriac110v);
    payload.driverDimTriac220vExtra = serializeExtra(driversExtra.dimTriac220v);
    // Serializar óticas extras como JSON
    const validOticasExtra = oticasExtra.filter((o) => o.modelo.trim());
    payload.oticaExtra = validOticasExtra.length > 0 ? JSON.stringify(validOticasExtra) : undefined;

    if (isEdit && editId) {
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // handleSubmit: verifica se há algum driver preenchido; se não, exibe aviso antes de salvar
  // Exceção: quando semDriver=true, salva diretamente sem exibir o alerta
  const handleSubmit = () => {
    const f = formRef.current;
    if (f.semDriver) {
      doSubmit();
      return;
    }
    const temAlgumDriver =
      (f.driverOnoff220 && f.driverOnoff220.trim()) ||
      (f.driverOnoffBivolt && f.driverOnoffBivolt.trim() && !f.driverOnoffBivoltNaoAplicavel) ||
      (f.driverDim110v && f.driverDim110v.trim() && !f.driverDim110vNaoAplicavel) ||
      (f.driverDimDali && f.driverDimDali.trim() && !f.driverDimDaliNaoAplicavel);
    if (!temAlgumDriver) {
      setShowSemDriverDialog(true);
      return;
    }
    doSubmit();
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  // formValid: campos obrigatórios preenchidos E nenhum erro real (com mensagem) no estado
  const formValid = isFormValid() && !Object.values(errors).some((msg) => !!msg);

  // ─── FieldWrapper and DriverRow are defined OUTSIDE this component (above) ──
  // to prevent React from remounting them on every state change (which would
  // destroy input focus after each keystroke).

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* Diálogo de aviso: produto sem driver */}
      {showSemDriverDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-base">Produto sem driver</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Nenhum driver foi cadastrado para este produto. Produtos sem driver não poderão ser configurados pelo sistema.<br /><br />
                  Deseja salvar mesmo assim?
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSemDriverDialog(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { setShowSemDriverDialog(false); doSubmit(); }}
                className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-semibold transition-colors"
              >
                Salvar sem driver
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {isEdit ? "EDITAR PRODUTO" : isDuplicate ? "DUPLICAR PRODUTO" : "CADASTRAR PRODUTO"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEdit
              ? "Atualize as informações do produto"
              : isDuplicate
              ? "Preencha o SKU e o nome do novo produto. Os demais campos foram copiados do original."
              : "Preencha os dados para cadastrar um novo produto"}
          </p>
        </div>
      </div>

      {/* Banner de duplicação */}
      {isDuplicate && produtoOriginalNome && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
          <Copy className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-cyan-400 tracking-wider">DUPLICANDO A PARTIR DE</p>
            <p className="text-sm text-cyan-300/80 mt-0.5">{produtoOriginalNome}</p>
            <p className="text-[11px] text-cyan-400/60 mt-1">O campo PRODUTO foi deixado em branco. Preencha o nome do novo produto antes de salvar. O SKU foi mantido pois produtos variantes podem compartilhá-lo.</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* ─── Seção 1: Identificação ─────────────────────────────────── */}
        <section className="alfalux-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Tag className="w-4 h-4 text-primary" />
            <h2 className="section-header mb-0">IDENTIFICAÇÃO DO PRODUTO</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {/* Categoria */}
            <FieldWrapper field="categoria" label="CATEGORIA" touched={touched} errors={errors}>
              <Select key={form.categoria || "_empty"} value={form.categoria} onValueChange={(v) => setField("categoria", v)}>
                <SelectTrigger className="input-dark">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>

            {/* Instalação */}
            <FieldWrapper field="instalacao" label="INSTALAÇÃO" required touched={touched} errors={errors}>
              <Select
                value={form.instalacao}
                onValueChange={(v) => { setField("instalacao", v); setTouched((p) => ({ ...p, instalacao: true })); }}
              >
                <SelectTrigger className={cn("input-dark", touched.instalacao && errors.instalacao && "border-destructive ring-1 ring-destructive")}>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {INSTALACOES.map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrapper>

            {/* Família */}
            <FieldWrapper field="familia" label="FAMÍLIA" required touched={touched} errors={errors}>
              <AutocompleteInput
                field="familia"
                value={form.familia}
                onChange={(v) => { setField("familia", v); setTouched((p) => ({ ...p, familia: true })); }}
                onBlur={() => setTouched((p) => ({ ...p, familia: true }))}
                placeholder="Ex: LUNA"
                hasError={!!(touched.familia && errors.familia)}
              />
            </FieldWrapper>

            {/* SKU */}
            <FieldWrapper field="sku" label="SKU" required touched={touched} errors={errors}>
              <Input
                className={cn("input-dark", touched.sku && errors.sku && "border-destructive ring-1 ring-destructive")}
                value={form.sku}
                onChange={(e) => handleTextUpper("sku", e.target.value)}
                placeholder="Ex: LDE 1400.120.19B"
              />
            </FieldWrapper>

            {/* Produto */}
            <FieldWrapper field="produto" label="PRODUTO" required className="lg:col-span-2" touched={touched} errors={errors}>
              <AutocompleteInput
                field="produto"
                value={form.produto}
                onChange={(v) => { setField("produto", v); setTouched((p) => ({ ...p, produto: true })); }}
                onBlur={() => setTouched((p) => ({ ...p, produto: true }))}
                placeholder="Ex: LUNA PP LED 6,5W RE ABS"
                hasError={!!(touched.produto && errors.produto)}
              />
            </FieldWrapper>
          </div>
        </section>

        {/* ─── Seção 2: Componentes ────────────────────────────────────── */}
        <section className="alfalux-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Cpu className="w-4 h-4 text-primary" />
            <h2 className="section-header mb-0">COMPONENTES</h2>
          </div>

          <div className="flex flex-col gap-5">
            {/* Módulo LED por CCT */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">MÓDULO LED</span>
                <span className="text-[10px] text-muted-foreground">Preencha o módulo para cada CCT disponível — CCT sem módulo será desabilitado</span>
              </div>
              <div className="flex flex-col gap-3">
                {([
                  { cct: "2700", field: "moduloLed2700" as const, qtdField: "qtdModuloLed2700" as const, color: "oklch(0.75 0.15 65)" },
                  { cct: "3000", field: "moduloLed3000" as const, qtdField: "qtdModuloLed3000" as const, color: "oklch(0.80 0.12 75)" },
                  { cct: "4000", field: "moduloLed4000" as const, qtdField: "qtdModuloLed4000" as const, color: "oklch(0.85 0.05 200)" },
                  { cct: "5000", field: "moduloLed5000" as const, qtdField: "qtdModuloLed5000" as const, color: "oklch(0.88 0.04 220)" },
                ] as const).map(({ cct, field, qtdField, color }) => (
                  <div key={cct} className="flex gap-3 items-center">
                    <div
                      className="flex-shrink-0 w-14 text-center text-xs font-bold rounded-md px-2 py-1.5 border"
                      style={{ borderColor: color, color, backgroundColor: `${color}15` }}
                    >
                      {cct}K
                    </div>
                    <div className="flex-1 min-w-0">
                      <ComponentSelect
                        tipo="MODULO_LED"
                        value={form[field]}
                        onChange={(v) => setField(field, v)}
                        placeholder={`Módulo ${cct}K (deixe vazio para desabilitar)`}
                        hasError={false}
                      />
                    </div>
                    {form[field] && (
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">QTD</span>
                        <Input
                          className="input-dark text-sm text-center px-2 w-16"
                          type="number"
                          min="0.01"
                          max="999"
                          step="0.01"
                          value={form[qtdField] ?? 1}
                          onChange={(e) => {
                            const raw = e.target.value.replace(',', '.');
                            const parsed = parseFloat(raw);
                            setField(qtdField, isNaN(parsed) ? 1 : Math.max(0.01, Math.round(parsed * 1000) / 1000));
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Ótica */}
            <FieldWrapper field="otica" label="ÓTICA MÓDULO LED" required={!form.oticaNaoAplicavel} touched={touched} errors={errors}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="otica-na"
                    checked={form.oticaNaoAplicavel}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      setForm((prev) => ({
                        ...prev,
                        oticaNaoAplicavel: checked,
                        otica: checked ? "NÃO APLICÁVEL" : "",
                      }));
                      if (checked) setOticasExtra([]);
                      setErrors((p) => ({ ...p, otica: undefined }));
                      setTouched((p) => ({ ...p, otica: false }));
                    }}
                    className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label htmlFor="otica-na" className="text-xs text-muted-foreground cursor-pointer select-none">
                    NÃO APLICÁVEL
                  </label>
                </div>
                {/* Ótica primária */}
                <div className="flex gap-3 items-center">
                  <div className="flex-shrink-0 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium w-16 text-right">
                    {!form.oticaNaoAplicavel && oticasExtra.length > 0 ? "PRIMÁRIA" : ""}
                  </div>
                  <div className="flex-1 min-w-0">
                    {form.oticaNaoAplicavel ? (
                      <Input className="input-dark" value="NÃO APLICÁVEL" disabled readOnly />
                    ) : (
                      <ComponentSelect
                        tipo="OTICA"
                        value={form.otica}
                        onChange={(v) => { setField("otica", v); setTouched((p) => ({ ...p, otica: true })); }}
                        onBlur={() => setTouched((p) => ({ ...p, otica: true }))}
                        placeholder="Ex: LENTE SPOT 24°"
                        hasError={!!(touched.otica && errors.otica && !form.oticaNaoAplicavel)}
                      />
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">QTD</span>
                    <Input
                      className="input-dark text-sm text-center px-2 w-16"
                      type="number"
                      min="1"
                      max="99"
                      step="1"
                      value={form.qtdOtica ?? 1}
                      onChange={(e) => setField("qtdOtica", Math.max(1, parseInt(e.target.value) || 1))}
                      title="Quantidade de óticas por produto"
                    />
                  </div>
                </div>
                {/* Óticas extras */}
                {!form.oticaNaoAplicavel && oticasExtra.map((oe, idx) => (
                  <OticaExtraRow
                    key={idx}
                    index={idx}
                    item={oe}
                    onChange={(updated) => setOticasExtra((prev) => prev.map((x, i) => i === idx ? updated : x))}
                    onRemove={() => setOticasExtra((prev) => prev.filter((_, i) => i !== idx))}
                  />
                ))}
                {/* Botão adicionar ótica */}
                {!form.oticaNaoAplicavel && (
                  <button
                    type="button"
                    onClick={() => setOticasExtra((prev) => [...prev, emptyOticaExtra()])}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-1 ml-[76px]"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Adicionar ótica
                  </button>
                )}
              </div>
            </FieldWrapper>

            {/* Holder */}
            <FieldWrapper field="holder" label="HOLDER" required={!form.holderNaoAplicavel} touched={touched} errors={errors}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="holder-na"
                    checked={form.holderNaoAplicavel}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      setForm((prev) => ({
                        ...prev,
                        holderNaoAplicavel: checked,
                        holder: checked ? "NÃO APLICÁVEL" : "",
                      }));
                      setErrors((p) => ({ ...p, holder: undefined }));
                      setTouched((p) => ({ ...p, holder: false }));
                    }}
                    className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label htmlFor="holder-na" className="text-xs text-muted-foreground cursor-pointer select-none">
                    NÃO APLICÁVEL
                  </label>
                </div>
                <div className="flex gap-3 items-center">
                  <div className="flex-1 min-w-0">
                    {form.holderNaoAplicavel ? (
                      <Input className="input-dark" value="NÃO APLICÁVEL" disabled readOnly />
                    ) : (
                      <ComponentSelect
                        tipo="HOLDER"
                        value={form.holder}
                        onChange={(v) => { setField("holder", v); setTouched((p) => ({ ...p, holder: true })); }}
                        onBlur={() => setTouched((p) => ({ ...p, holder: true }))}
                        placeholder="Ex: HOLDER ALUMÍNIO"
                        hasError={!!(touched.holder && errors.holder && !form.holderNaoAplicavel)}
                      />
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">QTD</span>
                    <Input
                      className="input-dark text-sm text-center px-2 w-16"
                      type="number"
                      min="1"
                      max="99"
                      step="1"
                      value={form.qtdHolder ?? 1}
                      onChange={(e) => setField("qtdHolder", Math.max(1, parseInt(e.target.value) || 1))}
                      title="Quantidade de holders por produto"
                    />
                  </div>
                </div>
              </div>
            </FieldWrapper>

            {/* Dissipador */}
            <FieldWrapper field="dissipador" label="DISSIPADOR MÓDULO LED" required={!form.dissipadorNaoAplicavel} touched={touched} errors={errors}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="dissipador-na"
                    checked={form.dissipadorNaoAplicavel}
                    onCheckedChange={(v) => {
                      const checked = !!v;
                      setForm((prev) => ({
                        ...prev,
                        dissipadorNaoAplicavel: checked,
                        dissipador: checked ? "NÃO APLICÁVEL" : "",
                      }));
                      setErrors((p) => ({ ...p, dissipador: undefined }));
                      setTouched((p) => ({ ...p, dissipador: false }));
                    }}
                    className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label htmlFor="dissipador-na" className="text-xs text-muted-foreground cursor-pointer select-none">
                    NÃO APLICÁVEL
                  </label>
                </div>
                <div className="flex gap-3 items-center">
                  <div className="flex-1 min-w-0">
                    {form.dissipadorNaoAplicavel ? (
                      <Input className="input-dark" value="NÃO APLICÁVEL" disabled readOnly />
                    ) : (
                      <ComponentSelect
                        tipo="DISSIPADOR"
                        value={form.dissipador}
                        onChange={(v) => { setField("dissipador", v); setTouched((p) => ({ ...p, dissipador: true })); }}
                        onBlur={() => setTouched((p) => ({ ...p, dissipador: true }))}
                        placeholder="Ex: DISSIPADOR ALUMÍNIO"
                        hasError={!!(touched.dissipador && errors.dissipador && !form.dissipadorNaoAplicavel)}
                      />
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">QTD</span>
                    <Input
                      className="input-dark text-sm text-center px-2 w-16"
                      type="number"
                      min="1"
                      max="99"
                      step="1"
                      value={form.qtdDissipador ?? 1}
                      onChange={(e) => setField("qtdDissipador", Math.max(1, parseInt(e.target.value) || 1))}
                      title="Quantidade de dissipadores por produto"
                    />
                  </div>
                </div>
              </div>
            </FieldWrapper>
          </div>
        </section>

        {/* ─── Seção 3: Drivers / Controle ─────────────────────────────── */}
        <section className="alfalux-card p-6">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-primary" />
            <h2 className="section-header mb-0">DRIVERS / CONTROLE</h2>
          </div>
                    <p className="text-xs text-muted-foreground mb-4">
            Para cada driver, informe o modelo e o custo unitário em R$ (opcional)
          </p>
          {/* Checkbox SEM DRIVER */}
          <div className="flex items-center gap-3 mb-5 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
            <input
              type="checkbox"
              id="semDriver"
              checked={form.semDriver}
              onChange={(e) => setField("semDriver", e.target.checked)}
              className="w-4 h-4 accent-amber-500 cursor-pointer"
            />
            <label htmlFor="semDriver" className="text-sm font-medium cursor-pointer select-none">
              Produto <span className="text-amber-400 font-semibold">SEM DRIVER</span>
              <span className="text-xs text-muted-foreground ml-2">(módulo tensão de rede ou com lâmpada)</span>
            </label>
          </div>
          <div className={cn("space-y-5", form.semDriver && "opacity-40 pointer-events-none select-none")}>
            {/* Cabeçalho das colunas */}
            <div className="flex gap-2 items-center">
              <div className="flex-1 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
                Modelo do driver
              </div>
              <div className="w-36 flex-shrink-0 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium text-center">
                Custo (R$)
              </div>
            </div>

            {/* ON/OFF 220Vac — obrigatório */}
            <div className="space-y-2">
              <DriverRow
                driverField="driverOnoff220"
                custoField="custoDriverOnoff220"
                qtdField="qtdDriverOnoff220"
                mkpPadraoDriverField="mkpPadraoDriverOnoff220v"
                label="ON/OFF DRIVER 220Vac"
                required
                placeholder="Ex: PHILIPS XITANIUM 19W 350MA (EQ00346)"
                form={form} touched={touched} errors={errors}
                setField={setField} setForm={setForm} setErrors={setErrors} setTouched={setTouched}
              />
              {driversExtra.onoff220.map((de, idx) => (
                <DriverExtraRow key={idx} tipo="DRIVER_ONOFF_220" item={de}
                  onChange={(updated) => setDriversExtra((prev) => ({ ...prev, onoff220: prev.onoff220.map((x, i) => i === idx ? updated : x) }))}
                  onRemove={() => setDriversExtra((prev) => ({ ...prev, onoff220: prev.onoff220.filter((_, i) => i !== idx) }))}
                />
              ))}
              <button type="button" onClick={() => setDriversExtra((prev) => ({ ...prev, onoff220: [...prev.onoff220, emptyDriverExtra()] }))}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-1">
                <PlusCircle className="w-3.5 h-3.5" /> Adicionar driver
              </button>
            </div>

            {/* ON/OFF BIVOLT — obrigatório (salvo se NaoAplicavel) */}
            <div className="space-y-2">
              <DriverRow
                driverField="driverOnoffBivolt"
                custoField="custoDriverOnoffBivolt"
                qtdField="qtdDriverOnoffBivolt"
                mkpPadraoDriverField="mkpPadraoDriverOnoffBivolt"
                naoAplicavelField="driverOnoffBivoltNaoAplicavel"
                label="ON/OFF DRIVER BIVOLT"
                required
                placeholder="Ex: LIFUD 13W 350MA BIVOLT (EQ00236)"
                form={form} touched={touched} errors={errors}
                setField={setField} setForm={setForm} setErrors={setErrors} setTouched={setTouched}
              />
              {driversExtra.onoffBivolt.map((de, idx) => (
                <DriverExtraRow key={idx} tipo="DRIVER_ONOFF_BIVOLT" item={de}
                  onChange={(updated) => setDriversExtra((prev) => ({ ...prev, onoffBivolt: prev.onoffBivolt.map((x, i) => i === idx ? updated : x) }))}
                  onRemove={() => setDriversExtra((prev) => ({ ...prev, onoffBivolt: prev.onoffBivolt.filter((_, i) => i !== idx) }))}
                />
              ))}
              <button type="button" onClick={() => setDriversExtra((prev) => ({ ...prev, onoffBivolt: [...prev.onoffBivolt, emptyDriverExtra()] }))}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-1">
                <PlusCircle className="w-3.5 h-3.5" /> Adicionar driver
              </button>
            </div>

            <div className="border-t border-border/40 pt-4">
              <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium mb-4">
                Drivers opcionais (preencha se disponível)
              </p>

              {/* DIM 1-10V */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <DriverRow
                    driverField="driverDim110v"
                    custoField="custoDriverDim110v"
                    qtdField="qtdDriverDim110v"
                    mkpPadraoDriverField="mkpPadraoDriverDim110v"
                    naoAplicavelField="driverDim110vNaoAplicavel"
                    label="DIM 1-10V"
                    optional
                    placeholder="Driver DIM 1-10V"
                    form={form} touched={touched} errors={errors}
                    setField={setField} setForm={setForm} setErrors={setErrors} setTouched={setTouched}
                  />
                  {driversExtra.dim110v.map((de, idx) => (
                    <DriverExtraRow key={idx} tipo="DRIVER_DIM_110V" item={de}
                      onChange={(updated) => setDriversExtra((prev) => ({ ...prev, dim110v: prev.dim110v.map((x, i) => i === idx ? updated : x) }))}
                      onRemove={() => setDriversExtra((prev) => ({ ...prev, dim110v: prev.dim110v.filter((_, i) => i !== idx) }))}
                    />
                  ))}
                  <button type="button" onClick={() => setDriversExtra((prev) => ({ ...prev, dim110v: [...prev.dim110v, emptyDriverExtra()] }))}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-1">
                    <PlusCircle className="w-3.5 h-3.5" /> Adicionar driver
                  </button>
                </div>

                {/* DIM DALI */}
                <div className="space-y-2">
                  <DriverRow
                    driverField="driverDimDali"
                    custoField="custoDriverDimDali"
                    qtdField="qtdDriverDimDali"
                    mkpPadraoDriverField="mkpPadraoDriverDimDali"
                    naoAplicavelField="driverDimDaliNaoAplicavel"
                    label="DIM DALI"
                    optional
                    placeholder="Driver DIM DALI"
                    form={form} touched={touched} errors={errors}
                    setField={setField} setForm={setForm} setErrors={setErrors} setTouched={setTouched}
                  />
                  {driversExtra.dimDali.map((de, idx) => (
                    <DriverExtraRow key={idx} tipo="DRIVER_DIM_DALI" item={de}
                      onChange={(updated) => setDriversExtra((prev) => ({ ...prev, dimDali: prev.dimDali.map((x, i) => i === idx ? updated : x) }))}
                      onRemove={() => setDriversExtra((prev) => ({ ...prev, dimDali: prev.dimDali.filter((_, i) => i !== idx) }))}
                    />
                  ))}
                  <button type="button" onClick={() => setDriversExtra((prev) => ({ ...prev, dimDali: [...prev.dimDali, emptyDriverExtra()] }))}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-1">
                    <PlusCircle className="w-3.5 h-3.5" /> Adicionar driver
                  </button>
                </div>

                {/* DIM TRIAC 110V */}
                <div className="space-y-2">
                  <DriverRow
                    driverField="driverDimTriac110v"
                    custoField="custoDriverDimTriac110v"
                    qtdField="qtdDriverDimTriac110v"
                    mkpPadraoDriverField="mkpPadraoDriverDimTriac110v"
                    naoAplicavelField="driverDimTriac110vNaoAplicavel"
                    label="DIM TRIAC 110V"
                    optional
                    placeholder="Driver DIM TRIAC 110V"
                    form={form} touched={touched} errors={errors}
                    setField={setField} setForm={setForm} setErrors={setErrors} setTouched={setTouched}
                  />
                  {driversExtra.dimTriac110v.map((de, idx) => (
                    <DriverExtraRow key={idx} tipo="DRIVER_DIM_TRIAC_110V" item={de}
                      onChange={(updated) => setDriversExtra((prev) => ({ ...prev, dimTriac110v: prev.dimTriac110v.map((x, i) => i === idx ? updated : x) }))}
                      onRemove={() => setDriversExtra((prev) => ({ ...prev, dimTriac110v: prev.dimTriac110v.filter((_, i) => i !== idx) }))}
                    />
                  ))}
                  <button type="button" onClick={() => setDriversExtra((prev) => ({ ...prev, dimTriac110v: [...prev.dimTriac110v, emptyDriverExtra()] }))}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-1">
                    <PlusCircle className="w-3.5 h-3.5" /> Adicionar driver
                  </button>
                </div>

                {/* DIM TRIAC 220V */}
                <div className="space-y-2">
                  <DriverRow
                    driverField="driverDimTriac220v"
                    custoField="custoDriverDimTriac220v"
                    qtdField="qtdDriverDimTriac220v"
                    mkpPadraoDriverField="mkpPadraoDriverDimTriac220v"
                    naoAplicavelField="driverDimTriac220vNaoAplicavel"
                    label="DIM TRIAC 220V"
                    optional
                    placeholder="Driver DIM TRIAC 220V"
                    form={form} touched={touched} errors={errors}
                    setField={setField} setForm={setForm} setErrors={setErrors} setTouched={setTouched}
                  />
                  {driversExtra.dimTriac220v.map((de, idx) => (
                    <DriverExtraRow key={idx} tipo="DRIVER_DIM_TRIAC_220V" item={de}
                      onChange={(updated) => setDriversExtra((prev) => ({ ...prev, dimTriac220v: prev.dimTriac220v.map((x, i) => i === idx ? updated : x) }))}
                      onRemove={() => setDriversExtra((prev) => ({ ...prev, dimTriac220v: prev.dimTriac220v.filter((_, i) => i !== idx) }))}
                    />
                  ))}
                  <button type="button" onClick={() => setDriversExtra((prev) => ({ ...prev, dimTriac220v: [...prev.dimTriac220v, emptyDriverExtra()] }))}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mt-1">
                    <PlusCircle className="w-3.5 h-3.5" /> Adicionar driver
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Seção 4: Temperatura de Cor ─────────────────────────────── */}
        <section className="alfalux-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Thermometer className="w-4 h-4 text-primary" />
            <h2 className="section-header mb-0">TEMPERATURA DE COR</h2>
            {(form.moduloLed2700 || form.moduloLed3000 || form.moduloLed4000 || form.moduloLed5000) ? (
              <span className="text-[10px] text-muted-foreground ml-auto">Derivado automaticamente dos módulos LED</span>
            ) : (
              <span className="text-[10px] text-muted-foreground ml-auto">Marcadas por padrão — desmarque se não aplicável</span>
            )}
          </div>

          {(form.moduloLed2700 || form.moduloLed3000 || form.moduloLed4000 || form.moduloLed5000) ? (
            // Modo derivado: CCTs determinados pelos módulos preenchidos
            <div className="flex flex-wrap gap-3">
              {TEMPERATURAS.map((temp) => {
                const fieldMap: Record<string, keyof FormData> = {
                  "2700": "moduloLed2700", "3000": "moduloLed3000",
                  "4000": "moduloLed4000", "5000": "moduloLed5000",
                };
                const active = !!(form[fieldMap[temp]]);
                const colors: Record<string, string> = {
                  "2700": "oklch(0.75 0.15 65)", "3000": "oklch(0.80 0.12 75)",
                  "4000": "oklch(0.85 0.05 200)", "5000": "oklch(0.88 0.04 220)",
                };
                return (
                  <div
                    key={temp}
                    className={cn("temp-badge cursor-default select-none", active ? "temp-badge-active" : "temp-badge-inactive opacity-40")}
                    style={active ? { borderColor: colors[temp], color: colors[temp], backgroundColor: `${colors[temp]}20` } : {}}
                    title={active ? `Módulo ${temp}K cadastrado` : `Sem módulo ${temp}K — CCT desabilitado`}
                  >
                    <span className="w-2 h-2 rounded-full mr-1.5 inline-block" style={{ backgroundColor: active ? colors[temp] : "currentColor", opacity: active ? 1 : 0.3 }} />
                    {temp}K
                  </div>
                );
              })}
            </div>
          ) : (
            // Modo manual: seleção livre (produtos legados sem módulos CCT)
            <>
              <div className="flex flex-wrap gap-3">
                {TEMPERATURAS.map((temp) => {
                  const active = form.temperaturasCor.includes(temp);
                  const colors: Record<string, string> = {
                    "2700": "oklch(0.75 0.15 65)", "3000": "oklch(0.80 0.12 75)",
                    "4000": "oklch(0.85 0.05 200)", "5000": "oklch(0.88 0.04 220)",
                  };
                  return (
                    <button
                      key={temp}
                      type="button"
                      onClick={() => toggleTemp(temp)}
                      className={cn("temp-badge", active ? "temp-badge-active" : "temp-badge-inactive")}
                      style={active ? { borderColor: colors[temp], color: colors[temp], backgroundColor: `${colors[temp]}20` } : {}}
                    >
                      <span className="w-2 h-2 rounded-full mr-1.5 inline-block" style={{ backgroundColor: active ? colors[temp] : "currentColor", opacity: active ? 1 : 0.3 }} />
                      {temp}K
                    </button>
                  );
                })}
              </div>
              {form.temperaturasCor.length === 0 && (
                <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Selecione pelo menos uma temperatura de cor
                </p>
              )}
            </>
          )}
        </section>

        {/* ─── Seção 5: Foto ────────────────────────────────────────────── */}
        <section className="alfalux-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <ImageIcon className="w-4 h-4 text-primary" />
            <h2 className="section-header mb-0">FOTO DO PRODUTO</h2>
            <span className="text-[10px] text-muted-foreground ml-auto">OPCIONAL — JPEG, JPG, PNG</span>
          </div>

          <div className="flex items-start gap-6">
            {/* Preview */}
            <div
              className={cn(
                "w-32 h-32 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden flex-shrink-0 transition-colors",
                photoPreview ? "border-primary/40" : "border-border hover:border-primary/40 cursor-pointer"
              )}
              onClick={() => !photoPreview && fileInputRef.current?.click()}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <ImageIcon className="w-8 h-8 opacity-40" />
                  <span className="text-[10px] tracking-wider">SEM FOTO</span>
                </div>
              )}
            </div>

            {/* Upload area */}
            <div className="flex-1">
              <div
                className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handlePhotoUpload(file);
                }}
              >
                <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {uploading ? "Enviando..." : "Arraste ou clique para selecionar"}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">JPEG, JPG, PNG — máx. 10MB</p>
              </div>
              {photoPreview && (
                <button
                  type="button"
                  onClick={() => { setPhotoPreview(null); setField("fotoUrl", ""); setField("fotoKey", ""); }}
                  className="mt-2 text-xs text-destructive hover:text-destructive/80 flex items-center gap-1 transition-colors"
                >
                  <X className="w-3 h-3" /> Remover foto
                </button>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            className="hidden"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePhotoUpload(file); }}
          />
        </section>

        {/* ─── Seção 6: Custo e Markup da Luminária ────────────────────── */}
        <section className="alfalux-card p-6">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-primary" />
            <h2 className="section-header mb-0">CUSTO E MARKUP DA LUMINÁRIA</h2>
            <span className="text-[10px] text-muted-foreground ml-auto">OPCIONAL — VALORES POR TIPO DE DRIVER</span>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            Informe o custo do corpo da luminária e os markups para cada tipo de driver. O Markup Padrão define o preço de lista; o Markup Mínimo é a trava de desconto máximo.
          </p>

          {/* Tabela de custo + markup por tipo de driver */}
          {(() => {
            const isPerfil = form.categoria?.toUpperCase() === "PERFIS";
            const drivers: Array<{
              label: string;
              custoField: keyof FormData;
              custoD1D2Field?: keyof FormData;
              mkpPField: keyof FormData;
              mkpMField: keyof FormData;
            }> = [
              { label: "ON/OFF 220Vac",    custoField: "custoCorpoOnoff220v",    custoD1D2Field: "custoCorpoOnoff220vD1D2",    mkpPField: "mkpPadraoOnoff220v",    mkpMField: "mkpMinimoOnoff220v" },
              { label: "ON/OFF Bivolt",    custoField: "custoCorpoOnoffBivolt",  custoD1D2Field: "custoCorpoOnoffBivoltD1D2",  mkpPField: "mkpPadraoOnoffBivolt",  mkpMField: "mkpMinimoOnoffBivolt" },
              { label: "Dim 1-10V 220Vac", custoField: "custoCorpoDim110v",      custoD1D2Field: "custoCorpoDim110vD1D2",      mkpPField: "mkpPadraoDim110v",      mkpMField: "mkpMinimoDim110v" },
              { label: "Dim DALI",         custoField: "custoCorpoDimDali",       custoD1D2Field: "custoCorpoDimDaliD1D2",       mkpPField: "mkpPadraoDimDali",       mkpMField: "mkpMinimoDimDali" },
              { label: "Dim Triac 110Vac", custoField: "custoCorpoDimTriac110v",  custoD1D2Field: "custoCorpoDimTriac110vD1D2",  mkpPField: "mkpPadraoDimTriac110v",  mkpMField: "mkpMinimoDimTriac110v" },
              { label: "Dim Triac 220Vac", custoField: "custoCorpoDimTriac220v",  custoD1D2Field: "custoCorpoDimTriac220vD1D2",  mkpPField: "mkpPadraoDimTriac220v",  mkpMField: "mkpMinimoDimTriac220v" },
            ];
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider pb-2 pr-4 font-medium">Tipo de Driver</th>
                      <th className="text-center text-[10px] text-muted-foreground uppercase tracking-wider pb-2 px-2 font-medium">
                        {isPerfil ? "Custo D1 — Ilum. Direta (R$)" : "Custo do Corpo (R$)"}
                      </th>
                      {isPerfil && (
                        <th className="text-center text-[10px] text-amber-400/80 uppercase tracking-wider pb-2 px-2 font-medium">Custo D1+D2 — Dir.+Indir. (R$)</th>
                      )}
                      <th className="text-center text-[10px] text-muted-foreground uppercase tracking-wider pb-2 px-2 font-medium">Markup Padrão</th>
                      <th className="text-center text-[10px] text-muted-foreground uppercase tracking-wider pb-2 px-2 font-medium">Markup Mínimo</th>
                      <th className="text-center text-[10px] text-muted-foreground uppercase tracking-wider pb-2 pl-2 font-medium">Preço de Lista (calc.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {drivers.map(({ label, custoField, custoD1D2Field, mkpPField, mkpMField }) => {
                      const custo = parseFloat(form[custoField] as string) || 0;
                      const mkpP = parseFloat(form[mkpPField] as string) || 0;
                      const precoLista = custo > 0 && mkpP > 0 ? (custo * mkpP).toFixed(2) : "—";
                      return (
                        <tr key={custoField} className="group">
                          <td className="py-2.5 pr-4">
                            <span className="text-xs font-medium text-foreground/80">{label}</span>
                          </td>
                          <td className="py-2.5 px-2">
                            <div className="relative w-32">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-medium pointer-events-none">R$</span>
                              <Input
                                className="input-dark pl-8 text-sm h-8"
                                type="number" step="0.01" min="0"
                                value={form[custoField] as string}
                                onChange={(e) => setField(custoField, e.target.value)}
                                placeholder="0,00"
                              />
                            </div>
                          </td>
                          {isPerfil && custoD1D2Field && (
                            <td className="py-2.5 px-2">
                              <div className="relative w-32">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-400/60 text-xs font-medium pointer-events-none">R$</span>
                                <Input
                                  className="input-dark pl-8 text-sm h-8 border-amber-400/30 focus:border-amber-400/60"
                                  type="number" step="0.01" min="0"
                                  value={form[custoD1D2Field] as string}
                                  onChange={(e) => setField(custoD1D2Field, e.target.value)}
                                  placeholder="0,00"
                                />
                              </div>
                            </td>
                          )}
                          <td className="py-2.5 px-2">
                            <Input
                              className="input-dark text-sm h-8 w-24 text-center"
                              type="number" step="0.1" min="1"
                              value={form[mkpPField] as string}
                              onChange={(e) => setField(mkpPField, e.target.value)}
                              placeholder="ex: 4"
                            />
                          </td>
                          <td className="py-2.5 px-2">
                            <Input
                              className="input-dark text-sm h-8 w-24 text-center"
                              type="number" step="0.1" min="1"
                              value={form[mkpMField] as string}
                              onChange={(e) => setField(mkpMField, e.target.value)}
                              placeholder="ex: 3"
                            />
                          </td>
                          <td className="py-2.5 pl-2 text-center">
                            <span className={`text-sm font-semibold ${
                              precoLista !== "—" ? "text-emerald-400" : "text-muted-foreground/40"
                            }`}>
                              {precoLista !== "—" ? `R$ ${precoLista}` : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}

        </section>

        {/* ─── Seção 7: Preço de Venda ────────────────────────────────── */}
        <section className="alfalux-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Tag className="w-4 h-4 text-emerald-400" />
            <h2 className="section-header mb-0">PREÇO DE VENDA</h2>
            <span className="text-[10px] text-muted-foreground ml-auto">
              OPCIONAL — {form.categoria?.toUpperCase() === "PERFIS" ? "R$/METRO LINEAR" : "R$/PEÇA"}
            </span>
          </div>

          <p className="text-xs text-muted-foreground mb-4">
            Informe o preço de venda para cada tipo de driver disponível neste produto.
            {form.categoria?.toUpperCase() === "PERFIS" && (
              <span className="ml-1 text-emerald-400 font-medium">Perfis: preço por metro linear.</span>
            )}
          </p>

          {/* Configuração de planos — apenas para PERFIS */}
          {form.categoria?.toUpperCase() === "PERFIS" && (
            <div className="mb-5 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <label className="block text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
                Configuração de Planos de Iluminação
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                Define como o perfil distribui a iluminação. Usado para selecionar o preço correto automaticamente.
              </p>
              <div className="flex gap-2 flex-wrap">
                {(["D1", "D2", "D1+D2"] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setField("configuracaoPlanos", form.configuracaoPlanos === opt ? "" : opt)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                      form.configuracaoPlanos === opt
                        ? "bg-amber-500 border-amber-500 text-black"
                        : "bg-transparent border-border text-muted-foreground hover:border-amber-400 hover:text-amber-400"
                    }`}
                  >
                    {opt === "D1" ? "D1 — Iluminação para baixo" :
                     opt === "D2" ? "D2 — Iluminação para cima" :
                     "D1+D2 — Dois planos (cima e baixo)"}
                  </button>
                ))}
              </div>
              {form.configuracaoPlanos && (
                <p className="text-xs text-amber-400/80 mt-2">
                  {form.configuracaoPlanos === "D1+D2"
                    ? "Os campos de preço D1+D2 abaixo serão usados pelo configurador."
                    : "Os campos de preço padrão abaixo serão usados pelo configurador."}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* ON/OFF 220V — sempre presente, sem flag NaoAplicavel */}
            <FieldWrapper label="ON/OFF 220Vac (R$)" touched={touched} errors={errors}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                <Input
                  className="input-dark pl-9"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.precoVendaOnoff220}
                  onChange={(e) => setField("precoVendaOnoff220", e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </FieldWrapper>

            {/* ON/OFF BIVOLT */}
            {!form.driverOnoffBivoltNaoAplicavel && (
              <FieldWrapper label="ON/OFF BIVOLT (R$)" touched={touched} errors={errors}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                  <Input
                    className="input-dark pl-9"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.precoVendaOnoffBivolt}
                    onChange={(e) => setField("precoVendaOnoffBivolt", e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </FieldWrapper>
            )}

            {/* DIM 1-10V */}
            {!form.driverDim110vNaoAplicavel && (
              <FieldWrapper label="DIM 1-10V (R$)" touched={touched} errors={errors}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                  <Input
                    className="input-dark pl-9"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.precoVendaDim110v}
                    onChange={(e) => setField("precoVendaDim110v", e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </FieldWrapper>
            )}

            {/* DIM DALI */}
            {!form.driverDimDaliNaoAplicavel && (
              <FieldWrapper label="DIM DALI (R$)" touched={touched} errors={errors}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                  <Input
                    className="input-dark pl-9"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.precoVendaDimDali}
                    onChange={(e) => setField("precoVendaDimDali", e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </FieldWrapper>
            )}

            {/* Preços D1/D1+D2 — apenas para PERFIS */}
            {form.categoria?.toUpperCase() === "PERFIS" && (
              <>
                <div className="col-span-full mt-2">
                  <div className="border-t border-border/40 pt-4 mb-3">
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Configuração D1+D2 (dois planos de iluminação)</span>
                    <p className="text-xs text-muted-foreground mt-1">Preencha quando o perfil puder ser instalado com dois conjuntos de barras (D1 para baixo + D2 para cima).</p>
                  </div>
                </div>
                <FieldWrapper label="ON/OFF 220Vac D1+D2 (R$)" touched={touched} errors={errors}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                    <Input className="input-dark pl-9" type="number" step="0.01" min="0"
                      value={form.precoVendaOnoff220D1D2}
                      onChange={(e) => setField("precoVendaOnoff220D1D2", e.target.value)}
                      placeholder="0,00" />
                  </div>
                </FieldWrapper>
                {!form.driverOnoffBivoltNaoAplicavel && (
                  <FieldWrapper label="ON/OFF BIVOLT D1+D2 (R$)" touched={touched} errors={errors}>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                      <Input className="input-dark pl-9" type="number" step="0.01" min="0"
                        value={form.precoVendaOnoffBivoltD1D2}
                        onChange={(e) => setField("precoVendaOnoffBivoltD1D2", e.target.value)}
                        placeholder="0,00" />
                    </div>
                  </FieldWrapper>
                )}
                {!form.driverDim110vNaoAplicavel && (
                  <FieldWrapper label="DIM 1-10V D1+D2 (R$)" touched={touched} errors={errors}>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                      <Input className="input-dark pl-9" type="number" step="0.01" min="0"
                        value={form.precoVendaDim110vD1D2}
                        onChange={(e) => setField("precoVendaDim110vD1D2", e.target.value)}
                        placeholder="0,00" />
                    </div>
                  </FieldWrapper>
                )}
                {!form.driverDimDaliNaoAplicavel && (
                  <FieldWrapper label="DIM DALI D1+D2 (R$)" touched={touched} errors={errors}>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                      <Input className="input-dark pl-9" type="number" step="0.01" min="0"
                        value={form.precoVendaDimDaliD1D2}
                        onChange={(e) => setField("precoVendaDimDaliD1D2", e.target.value)}
                        placeholder="0,00" />
                    </div>
                  </FieldWrapper>
                )}
              </>
            )}

            {/* Fallback: todos os drivers são NÃO APLICÁVEL */}
            {form.driverOnoffBivoltNaoAplicavel && form.driverDim110vNaoAplicavel && form.driverDimDaliNaoAplicavel && (
              <div className="col-span-2">
                <FieldWrapper label="ON/OFF 220Vac (R$)" touched={touched} errors={errors}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                    <Input
                      className="input-dark pl-9"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.precoVendaOnoff220}
                      onChange={(e) => setField("precoVendaOnoff220", e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                </FieldWrapper>
              </div>
            )}
          </div>
        </section>

        {/* ─── Validação Summary ───────────────────────────────────────── */}
        {Object.entries(errors).some(([, msg]) => !!msg) && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="text-sm font-semibold text-destructive">CAMPOS OBRIGATÓRIOS FALTANDO</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(errors).filter(([, msg]) => !!msg).map(([field, msg]) => (
                <span key={field} className="text-xs bg-destructive/20 text-destructive px-2 py-1 rounded-md">
                  {FIELD_LABELS[field] || field}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ─── Submit Button ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="px-6 py-3 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all"
          >
            CANCELAR
          </button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !formValid}
            className={cn(
              "px-10 py-3 h-auto text-sm font-bold tracking-wider rounded-xl transition-all",
              formValid
                ? "bg-blue-600 hover:bg-blue-500 text-white btn-glow"
                : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
            )}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {isEdit ? "SALVANDO..." : "CADASTRANDO..."}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                {isEdit ? <Save className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {isEdit ? "SALVAR ALTERAÇÕES" : "CADASTRAR PRODUTO"}
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
