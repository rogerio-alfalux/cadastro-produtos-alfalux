import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  DollarSign,
  Cpu,
  Lightbulb,
  Settings,
  Tag,
  Thermometer,
  ArrowLeft,
  Save,
} from "lucide-react";

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
  otica: string;
  oticaNaoAplicavel: boolean;
  holder: string;
  holderNaoAplicavel: boolean;
  dissipador: string;
  dissipadorNaoAplicavel: boolean;
  driverOnoff220: string;
  driverOnoffBivolt: string;
  driverDim110v: string;
  driverDimDali: string;
  temperaturasCor: string[];
  fotoUrl: string;
  fotoKey: string;
  custoLuminaria: string;
  custoDriver: string;
}

const defaultForm: FormData = {
  categoria: "",
  instalacao: "",
  familia: "",
  sku: "",
  produto: "",
  moduloLed: "",
  otica: "",
  oticaNaoAplicavel: false,
  holder: "",
  holderNaoAplicavel: false,
  dissipador: "",
  dissipadorNaoAplicavel: false,
  driverOnoff220: "",
  driverOnoffBivolt: "",
  driverDim110v: "",
  driverDimDali: "",
  temperaturasCor: ["2700", "3000", "4000", "5000"],
  fotoUrl: "",
  fotoKey: "",
  custoLuminaria: "",
  custoDriver: "",
};

// Required fields
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
  onSuccess?: () => void;
}

export default function ProductForm({ editId, onSuccess }: ProductFormProps) {
  const [, navigate] = useLocation();
  const [form, setForm] = useState<FormData>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = !!editId;

  // Load existing product for edit
  const { data: existingProduct } = trpc.products.getById.useQuery(
    { id: editId! },
    { enabled: !!editId }
  );

  useEffect(() => {
    if (existingProduct) {
      const temps = (() => {
        try { return JSON.parse(existingProduct.temperaturasCor || "[]"); }
        catch { return ["2700", "3000", "4000", "5000"]; }
      })();
      setForm({
        categoria: existingProduct.categoria || "",
        instalacao: existingProduct.instalacao || "",
        familia: existingProduct.familia || "",
        sku: existingProduct.sku || "",
        produto: existingProduct.produto || "",
        moduloLed: existingProduct.moduloLed || "",
        otica: existingProduct.oticaNaoAplicavel ? "" : (existingProduct.otica || ""),
        oticaNaoAplicavel: existingProduct.oticaNaoAplicavel || false,
        holder: existingProduct.holderNaoAplicavel ? "" : (existingProduct.holder || ""),
        holderNaoAplicavel: existingProduct.holderNaoAplicavel || false,
        dissipador: existingProduct.dissipadorNaoAplicavel ? "" : (existingProduct.dissipador || ""),
        dissipadorNaoAplicavel: existingProduct.dissipadorNaoAplicavel || false,
        driverOnoff220: existingProduct.driverOnoff220 || "",
        driverOnoffBivolt: existingProduct.driverOnoffBivolt || "",
        driverDim110v: existingProduct.driverDim110v || "",
        driverDimDali: existingProduct.driverDimDali || "",
        temperaturasCor: temps,
        fotoUrl: existingProduct.fotoUrl || "",
        fotoKey: existingProduct.fotoKey || "",
        custoLuminaria: existingProduct.custoLuminaria ? String(existingProduct.custoLuminaria) : "",
        custoDriver: existingProduct.custoDriver ? String(existingProduct.custoDriver) : "",
      });
      if (existingProduct.fotoUrl) setPhotoPreview(existingProduct.fotoUrl);
    }
  }, [existingProduct]);

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

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    for (const field of REQUIRED_FIELDS) {
      if (field === "otica" && form.oticaNaoAplicavel) continue;
      if (field === "holder" && form.holderNaoAplicavel) continue;
      if (field === "dissipador" && form.dissipadorNaoAplicavel) continue;

      const value = form[field];
      if (!value || (typeof value === "string" && !value.trim())) {
        newErrors[field] = `${FIELD_LABELS[field]} é obrigatório`;
      }
    }

    setErrors(newErrors);
    // Mark all required fields as touched
    const allTouched: Partial<Record<keyof FormData, boolean>> = {};
    REQUIRED_FIELDS.forEach((f) => (allTouched[f] = true));
    setTouched(allTouched);

    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = (): boolean => {
    for (const field of REQUIRED_FIELDS) {
      if (field === "otica" && form.oticaNaoAplicavel) continue;
      if (field === "holder" && form.holderNaoAplicavel) continue;
      if (field === "dissipador" && form.dissipadorNaoAplicavel) continue;
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
    if (!validate()) {
      toast.error("Preencha todos os campos obrigatórios");
      // Scroll to first error
      setTimeout(() => {
        const el = document.querySelector(".field-error");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      return;
    }

    const payload = {
      ...form,
      temperaturasCor: JSON.stringify(form.temperaturasCor),
      custoLuminaria: form.custoLuminaria || undefined,
      custoDriver: form.custoDriver || undefined,
      fotoUrl: form.fotoUrl || undefined,
      fotoKey: form.fotoKey || undefined,
      driverDim110v: form.driverDim110v || undefined,
      driverDimDali: form.driverDimDali || undefined,
    };

    if (isEdit && editId) {
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const formValid = isFormValid();

  // ─── Field component ─────────────────────────────────────────────────────

  const FieldWrapper = ({
    field,
    label,
    required,
    children,
    className,
  }: {
    field?: keyof FormData;
    label: string;
    required?: boolean;
    children: React.ReactNode;
    className?: string;
  }) => {
    const hasError = field && touched[field] && errors[field];
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
            {errors[field]}
          </p>
        )}
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {isEdit ? "EDITAR PRODUTO" : "CADASTRAR PRODUTO"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEdit ? "Atualize as informações do produto" : "Preencha os dados para cadastrar um novo produto"}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* ─── Seção 1: Identificação ─────────────────────────────────── */}
        <section className="alfalux-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Tag className="w-4 h-4 text-primary" />
            <h2 className="section-header mb-0">IDENTIFICAÇÃO DO PRODUTO</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Categoria */}
            <FieldWrapper field="categoria" label="CATEGORIA">
              <Select value={form.categoria} onValueChange={(v) => setField("categoria", v)}>
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
            <FieldWrapper field="instalacao" label="INSTALAÇÃO" required>
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
            <FieldWrapper field="familia" label="FAMÍLIA" required>
              <Input
                className={cn("input-dark", touched.familia && errors.familia && "border-destructive ring-1 ring-destructive")}
                value={form.familia}
                onChange={(e) => handleTextUpper("familia", e.target.value)}
                placeholder="Ex: LUNA"
              />
            </FieldWrapper>

            {/* SKU */}
            <FieldWrapper field="sku" label="SKU" required>
              <Input
                className={cn("input-dark", touched.sku && errors.sku && "border-destructive ring-1 ring-destructive")}
                value={form.sku}
                onChange={(e) => handleTextUpper("sku", e.target.value)}
                placeholder="Ex: LDE 1400.120.19B"
              />
            </FieldWrapper>

            {/* Produto */}
            <FieldWrapper field="produto" label="PRODUTO" required className="lg:col-span-2">
              <Input
                className={cn("input-dark", touched.produto && errors.produto && "border-destructive ring-1 ring-destructive")}
                value={form.produto}
                onChange={(e) => handleTextUpper("produto", e.target.value)}
                placeholder="Ex: LUNA PP LED 6,5W RE ABS"
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
            <FieldWrapper field="moduloLed" label="MÓDULO LED" required className="md:col-span-2">
              <Input
                className={cn("input-dark", touched.moduloLed && errors.moduloLed && "border-destructive ring-1 ring-destructive")}
                value={form.moduloLed}
                onChange={(e) => handleTextUpper("moduloLed", e.target.value)}
                placeholder="Ex: TRACE CIRCULAR 6 LEDS Ø50MM [CCT]"
              />
            </FieldWrapper>

            {/* Ótica */}
            <FieldWrapper field="otica" label="ÓTICA MÓDULO LED" required={!form.oticaNaoAplicavel}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="otica-na"
                    checked={form.oticaNaoAplicavel}
                    onCheckedChange={(v) => {
                      setField("oticaNaoAplicavel", !!v);
                      if (v) { setField("otica", "NÃO APLICÁVEL"); setErrors((p) => ({ ...p, otica: undefined })); }
                      else setField("otica", "");
                    }}
                    className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label htmlFor="otica-na" className="text-xs text-muted-foreground cursor-pointer select-none">
                    NÃO APLICÁVEL
                  </label>
                </div>
                <Input
                  className={cn("input-dark", touched.otica && errors.otica && !form.oticaNaoAplicavel && "border-destructive ring-1 ring-destructive")}
                  value={form.oticaNaoAplicavel ? "NÃO APLICÁVEL" : form.otica}
                  onChange={(e) => handleTextUpper("otica", e.target.value)}
                  disabled={form.oticaNaoAplicavel}
                  placeholder="Ex: LENTE SPOT 24°"
                />
              </div>
            </FieldWrapper>

            {/* Holder */}
            <FieldWrapper field="holder" label="HOLDER" required={!form.holderNaoAplicavel}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="holder-na"
                    checked={form.holderNaoAplicavel}
                    onCheckedChange={(v) => {
                      setField("holderNaoAplicavel", !!v);
                      if (v) { setField("holder", "NÃO APLICÁVEL"); setErrors((p) => ({ ...p, holder: undefined })); }
                      else setField("holder", "");
                    }}
                    className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label htmlFor="holder-na" className="text-xs text-muted-foreground cursor-pointer select-none">
                    NÃO APLICÁVEL
                  </label>
                </div>
                <Input
                  className={cn("input-dark", touched.holder && errors.holder && !form.holderNaoAplicavel && "border-destructive ring-1 ring-destructive")}
                  value={form.holderNaoAplicavel ? "NÃO APLICÁVEL" : form.holder}
                  onChange={(e) => handleTextUpper("holder", e.target.value)}
                  disabled={form.holderNaoAplicavel}
                  placeholder="Ex: HOLDER ALUMÍNIO"
                />
              </div>
            </FieldWrapper>

            {/* Dissipador */}
            <FieldWrapper field="dissipador" label="DISSIPADOR MÓDULO LED" required={!form.dissipadorNaoAplicavel}>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="dissipador-na"
                    checked={form.dissipadorNaoAplicavel}
                    onCheckedChange={(v) => {
                      setField("dissipadorNaoAplicavel", !!v);
                      if (v) { setField("dissipador", "NÃO APLICÁVEL"); setErrors((p) => ({ ...p, dissipador: undefined })); }
                      else setField("dissipador", "");
                    }}
                    className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label htmlFor="dissipador-na" className="text-xs text-muted-foreground cursor-pointer select-none">
                    NÃO APLICÁVEL
                  </label>
                </div>
                <Input
                  className={cn("input-dark", touched.dissipador && errors.dissipador && !form.dissipadorNaoAplicavel && "border-destructive ring-1 ring-destructive")}
                  value={form.dissipadorNaoAplicavel ? "NÃO APLICÁVEL" : form.dissipador}
                  onChange={(e) => handleTextUpper("dissipador", e.target.value)}
                  disabled={form.dissipadorNaoAplicavel}
                  placeholder="Ex: DISSIPADOR ALUMÍNIO"
                />
              </div>
            </FieldWrapper>
          </div>
        </section>

        {/* ─── Seção 3: Drivers / Controle ─────────────────────────────── */}
        <section className="alfalux-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Settings className="w-4 h-4 text-primary" />
            <h2 className="section-header mb-0">DRIVERS / CONTROLE</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* ON/OFF 220Vac */}
            <FieldWrapper field="driverOnoff220" label="ON/OFF DRIVER 220Vac" required>
              <Input
                className={cn("input-dark", touched.driverOnoff220 && errors.driverOnoff220 && "border-destructive ring-1 ring-destructive")}
                value={form.driverOnoff220}
                onChange={(e) => handleTextUpper("driverOnoff220", e.target.value)}
                placeholder="Ex: PHILIPS XITANIUM 19W 350MA (EQ00346)"
              />
            </FieldWrapper>

            {/* ON/OFF BIVOLT */}
            <FieldWrapper field="driverOnoffBivolt" label="ON/OFF DRIVER BIVOLT" required>
              <Input
                className={cn("input-dark", touched.driverOnoffBivolt && errors.driverOnoffBivolt && "border-destructive ring-1 ring-destructive")}
                value={form.driverOnoffBivolt}
                onChange={(e) => handleTextUpper("driverOnoffBivolt", e.target.value)}
                placeholder="Ex: LIFUD 13W 350MA BIVOLT (EQ00236)"
              />
            </FieldWrapper>

            {/* DIM 1-10V */}
            <FieldWrapper label="DIM 1-10V">
              <div className="relative">
                <Input
                  className="input-dark"
                  value={form.driverDim110v}
                  onChange={(e) => handleTextUpper("driverDim110v", e.target.value)}
                  placeholder="Driver DIM 1-10V (opcional)"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60 font-medium tracking-wider">
                  OPCIONAL
                </span>
              </div>
            </FieldWrapper>

            {/* DIM DALI */}
            <FieldWrapper label="DIM DALI">
              <div className="relative">
                <Input
                  className="input-dark"
                  value={form.driverDimDali}
                  onChange={(e) => handleTextUpper("driverDimDali", e.target.value)}
                  placeholder="Driver DIM DALI (opcional)"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60 font-medium tracking-wider">
                  OPCIONAL
                </span>
              </div>
            </FieldWrapper>
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

        {/* ─── Seção 6: Custos ─────────────────────────────────────────── */}
        <section className="alfalux-card p-6">
          <div className="flex items-center gap-2 mb-5">
            <DollarSign className="w-4 h-4 text-primary" />
            <h2 className="section-header mb-0">CUSTOS</h2>
            <span className="text-[10px] text-muted-foreground ml-auto">OPCIONAL — VALORES EM R$</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FieldWrapper label="CUSTO DA LUMINÁRIA (R$)">
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

            <FieldWrapper label="CUSTO DO DRIVER (R$)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                <Input
                  className="input-dark pl-9"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.custoDriver}
                  onChange={(e) => setField("custoDriver", e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </FieldWrapper>
          </div>
        </section>

        {/* ─── Validation Summary ───────────────────────────────────────── */}
        {Object.keys(errors).length > 0 && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span className="text-sm font-semibold text-destructive">CAMPOS OBRIGATÓRIOS FALTANDO</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(errors).map(([field, msg]) => (
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
