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

const driverTypeMap: Record<string, "DRIVER_ONOFF_220" | "DRIVER_ONOFF_BIVOLT" | "DRIVER_DIM_110V" | "DRIVER_DIM_DALI"> = {
  driverOnoff220: "DRIVER_ONOFF_220",
  driverOnoffBivolt: "DRIVER_ONOFF_BIVOLT",
  driverDim110v: "DRIVER_DIM_110V",
  driverDimDali: "DRIVER_DIM_DALI",
};

const DriverRow = ({
  driverField, custoField, qtdField, naoAplicavelField, label, required, placeholder, optional,
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
  tipo: "DRIVER_ONOFF_220" | "DRIVER_ONOFF_BIVOLT" | "DRIVER_DIM_110V" | "DRIVER_DIM_DALI";
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
};

const emptyDriverExtra = (): DriverExtra => ({ modelo: "", qtd: 1, custo: "" });

const defaultDriversExtra: DriversExtraState = {
  onoff220: [],
  onoffBivolt: [],
  dim110v: [],
  dimDali: [],
};

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
  otica: string;
  qtdOtica: number;
  oticaNaoAplicavel: boolean;
  holder: string;
  qtdHolder: number;
  holderNaoAplicavel: boolean;
  dissipador: string;
  qtdDissipador: number;
  dissipadorNaoAplicavel: boolean;
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
  temperaturasCor: string[];
  fotoUrl: string;
  fotoKey: string;
  custoLuminaria: string;
}

const defaultForm: FormData = {
  categoria: "",
  instalacao: "",
  familia: "",
  sku: "",
  produto: "",
  moduloLed: "",
  qtdModuloLed: 1,
  otica: "",
  qtdOtica: 1,
  oticaNaoAplicavel: false,
  holder: "",
  qtdHolder: 1,
  holderNaoAplicavel: false,
  dissipador: "",
  qtdDissipador: 1,
  dissipadorNaoAplicavel: false,
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
  temperaturasCor: ["2700", "3000", "4000", "5000"],
  fotoUrl: "",
  fotoKey: "",
  custoLuminaria: "",
};

// Required fields (driverOnoffBivolt is conditional — required only if not NaoAplicavel)
const REQUIRED_FIELDS: (keyof FormData)[] = [
  "instalacao", "familia", "sku", "produto", "moduloLed",
  "otica", "holder", "dissipador", "driverOnoff220", "driverOnoffBivolt",
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
  driverOnoff220: "ON/OFF DRIVER 220Vac",
  driverOnoffBivolt: "ON/OFF DRIVER BIVOLT",
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
        temperaturasCor: temps,
        fotoUrl: existingProduct.fotoUrl || "",
        fotoKey: existingProduct.fotoKey || "",
        custoLuminaria: existingProduct.custoLuminaria ? String(existingProduct.custoLuminaria) : "",
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
      });

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
        setField("fotoUrl", data.url);
        setField("fotoKey", data.key);
        setPhotoPreview(data.url);
        toast.success("Foto enviada com sucesso!");
      }
    } catch {
      toast.error("Erro ao enviar foto");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = {
      ...form,
      temperaturasCor: JSON.stringify(form.temperaturasCor),
      custoLuminaria: form.custoLuminaria || undefined,
      custoDriverOnoff220: form.custoDriverOnoff220 || undefined,
      custoDriverOnoffBivolt: form.custoDriverOnoffBivolt || undefined,
      custoDriverDim110v: form.custoDriverDim110v || undefined,
      custoDriverDimDali: form.custoDriverDimDali || undefined,
      fotoUrl: form.fotoUrl || undefined,
      fotoKey: form.fotoKey || undefined,
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

    // Serializar drivers extras como JSON
    const serializeExtra = (arr: DriverExtra[]) =>
      arr.length > 0 ? JSON.stringify(arr.filter((d) => d.modelo.trim())) : undefined;
    payload.driverOnoff220Extra = serializeExtra(driversExtra.onoff220);
    payload.driverOnoffBivoltExtra = serializeExtra(driversExtra.onoffBivolt);
    payload.driverDim110vExtra = serializeExtra(driversExtra.dim110v);
    payload.driverDimDaliExtra = serializeExtra(driversExtra.dimDali);

    if (isEdit && editId) {
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  // formValid: campos obrigatórios preenchidos E nenhum erro real (com mensagem) no estado
  const formValid = isFormValid() && !Object.values(errors).some((msg) => !!msg);

  // ─── FieldWrapper and DriverRow are defined OUTSIDE this component (above) ──
  // to prevent React from remounting them on every state change (which would
  // destroy input focus after each keystroke).

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Módulo LED */}
            <FieldWrapper field="moduloLed" label="MÓDULO LED" required className="md:col-span-2" touched={touched} errors={errors}>
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <ComponentSelect
                    tipo="MODULO_LED"
                    value={form.moduloLed}
                    onChange={(v) => { setField("moduloLed", v); setTouched((p) => ({ ...p, moduloLed: true })); }}
                    onBlur={() => setTouched((p) => ({ ...p, moduloLed: true }))}
                    placeholder="Ex: TRACE CIRCULAR 6 LEDS Ø50MM [CCT]"
                    hasError={!!(touched.moduloLed && errors.moduloLed)}
                  />
                </div>
                <div className="relative flex-shrink-0 w-16">
                  <Input
                    className="input-dark text-sm text-center px-2"
                    type="number"
                    min="1"
                    max="99"
                    step="1"
                    value={form.qtdModuloLed ?? 1}
                    onChange={(e) => setField("qtdModuloLed", Math.max(1, parseInt(e.target.value) || 1))}
                    title="Quantidade de módulos LED por produto"
                  />
                  <span className="absolute -top-4 left-0 right-0 text-center text-[9px] text-muted-foreground/50 uppercase tracking-wider whitespace-nowrap">Qtd</span>
                </div>
              </div>
            </FieldWrapper>

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
                      setErrors((p) => ({ ...p, otica: undefined }));
                      setTouched((p) => ({ ...p, otica: false }));
                    }}
                    className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label htmlFor="otica-na" className="text-xs text-muted-foreground cursor-pointer select-none">
                    NÃO APLICÁVEL
                  </label>
                </div>
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
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
                  <div className="relative flex-shrink-0 w-16">
                    <Input
                      className="input-dark text-sm text-center px-2"
                      type="number"
                      min="1"
                      max="99"
                      step="1"
                      value={form.qtdOtica ?? 1}
                      onChange={(e) => setField("qtdOtica", Math.max(1, parseInt(e.target.value) || 1))}
                      title="Quantidade de óticas por produto"
                    />
                    <span className="absolute -top-4 left-0 right-0 text-center text-[9px] text-muted-foreground/50 uppercase tracking-wider whitespace-nowrap">Qtd</span>
                  </div>
                </div>
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
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
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
                  <div className="relative flex-shrink-0 w-16">
                    <Input
                      className="input-dark text-sm text-center px-2"
                      type="number"
                      min="1"
                      max="99"
                      step="1"
                      value={form.qtdHolder ?? 1}
                      onChange={(e) => setField("qtdHolder", Math.max(1, parseInt(e.target.value) || 1))}
                      title="Quantidade de holders por produto"
                    />
                    <span className="absolute -top-4 left-0 right-0 text-center text-[9px] text-muted-foreground/50 uppercase tracking-wider whitespace-nowrap">Qtd</span>
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
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
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
                  <div className="relative flex-shrink-0 w-16">
                    <Input
                      className="input-dark text-sm text-center px-2"
                      type="number"
                      min="1"
                      max="99"
                      step="1"
                      value={form.qtdDissipador ?? 1}
                      onChange={(e) => setField("qtdDissipador", Math.max(1, parseInt(e.target.value) || 1))}
                      title="Quantidade de dissipadores por produto"
                    />
                    <span className="absolute -top-4 left-0 right-0 text-center text-[9px] text-muted-foreground/50 uppercase tracking-wider whitespace-nowrap">Qtd</span>
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
          <p className="text-xs text-muted-foreground mb-5">
            Para cada driver, informe o modelo e o custo unitário em R$ (opcional)
          </p>

          <div className="space-y-5">
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
              </div>
            </div>
          </div>
        </section>

        {/* ─── Seção 4: Temperatura de Cor ─────────────────────────────── */}
        <section className="alfalux-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Thermometer className="w-4 h-4 text-primary" />
            <h2 className="section-header mb-0">TEMPERATURA DE COR</h2>
            <span className="text-[10px] text-muted-foreground ml-auto">Marcadas por padrão — desmarque se não aplicável</span>
          </div>

          <div className="flex flex-wrap gap-3">
            {TEMPERATURAS.map((temp) => {
              const active = form.temperaturasCor.includes(temp);
              const colors: Record<string, string> = {
                "2700": "oklch(0.75 0.15 65)",
                "3000": "oklch(0.80 0.12 75)",
                "4000": "oklch(0.85 0.05 200)",
                "5000": "oklch(0.88 0.04 220)",
              };
              return (
                <button
                  key={temp}
                  type="button"
                  onClick={() => toggleTemp(temp)}
                  className={cn(
                    "temp-badge",
                    active ? "temp-badge-active" : "temp-badge-inactive"
                  )}
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

        {/* ─── Seção 6: Custo da Luminária ─────────────────────────────── */}
        <section className="alfalux-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <DollarSign className="w-4 h-4 text-primary" />
            <h2 className="section-header mb-0">CUSTO DA LUMINÁRIA</h2>
            <span className="text-[10px] text-muted-foreground ml-auto">OPCIONAL — VALOR EM R$</span>
          </div>

          <div className="max-w-xs">
            <FieldWrapper label="CUSTO DO CORPO DA LUMINÁRIA (R$)" touched={touched} errors={errors}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                <Input
                  className="input-dark pl-9"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.custoLuminaria}
                  onChange={(e) => setField("custoLuminaria", e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </FieldWrapper>
          </div>
        </section>

        {/* ─── Validation Summary ───────────────────────────────────────── */}
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
