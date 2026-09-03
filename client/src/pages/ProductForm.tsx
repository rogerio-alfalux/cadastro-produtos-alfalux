import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { can } from "@shared/permissions";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AutocompleteInput } from "@/components/AutocompleteInput";
import { ComponentSelect } from "@/components/ComponentSelect";
import { AccessorySelect } from "@/components/AccessorySelect";
import { emptyOtherEquipment, hydrateOtherEquipmentRecords, parseStoredOtherEquipment, type OtherEquipmentRecord } from "@shared/otherEquipment";
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
  FileText,
  FileCode2,
  Ruler,
  BookOpen,
  ExternalLink,
  Loader2,
  Lightbulb,
  SlidersHorizontal,
  Ban,
  Boxes,
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
                  value={(form[custoField] as string) ?? ''}
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
          value={item.custo ?? ''}
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

const CATEGORIAS = ["PERFIS", "DOWNLIGHTS", "PAINÉIS", "SPOTS", "ARANDELAS", "ÁREA EXTERNA", "BALIZADORES", "DECORATIVAS", "CUSTOMIZADOS"];
const INSTALACOES = ["EMBUTIR", "SOBREPOR", "PENDENTE", "ARANDELA", "NO FRAME"];
const TEMPERATURAS = ["2700", "3000", "3500", "4000", "5000"];

interface ModuloLedExtra {
  cct: string;
  modelo: string;
  qtd: number;
}

type OutroEquipamento = OtherEquipmentRecord;

type ProductDocumentType = "datasheet" | "fotometria" | "desenhoTecnico" | "manualInstalacao";

interface ProductDocument {
  url: string;
  key: string;
  nome: string;
  mimeType: string;
}

type ProductDocuments = Partial<Record<ProductDocumentType, ProductDocument>>;

const DOCUMENT_CONFIG: Record<ProductDocumentType, { sigla: string; label: string; accept: string; hint: string }> = {
  datasheet: { sigla: "DS", label: "Datasheet", accept: ".pdf,application/pdf", hint: "PDF" },
  fotometria: { sigla: "IES", label: "Fotometria", accept: ".ies", hint: "arquivo IES" },
  desenhoTecnico: { sigla: "DT", label: "Desenho Técnico", accept: ".pdf,.dwg,.dxf,.png,.jpg,.jpeg", hint: "PDF, DWG, DXF ou imagem" },
  manualInstalacao: { sigla: "MI", label: "Manual de Instalação", accept: ".pdf,application/pdf", hint: "PDF" },
};

function parseProductDocuments(raw: unknown): ProductDocuments {
  if (!raw) return {};
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: ProductDocuments = {};
    for (const tipo of Object.keys(DOCUMENT_CONFIG) as ProductDocumentType[]) {
      const value = (parsed as Record<string, unknown>)[tipo];
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const document = value as Record<string, unknown>;
      const url = String(document.url ?? "").trim();
      const key = String(document.key ?? "").trim();
      const nome = String(document.nome ?? "").trim();
      const mimeType = String(document.mimeType ?? "application/octet-stream");
      if (url && key && nome) result[tipo] = { url, key, nome, mimeType };
    }
    return result;
  } catch {
    return {};
  }
}

function getProductDocumentViewUrls(raw: unknown): Partial<Record<ProductDocumentType, string>> {
  const documents = parseProductDocuments(raw);
  return Object.fromEntries(
    (Object.keys(documents) as ProductDocumentType[])
      .map((tipo) => [tipo, documents[tipo]?.url] as const)
      .filter((entry): entry is [ProductDocumentType, string] => Boolean(entry[1])),
  );
}

const emptyModuloLedExtra = (): ModuloLedExtra => ({ cct: "", modelo: "", qtd: 1 });

function parseModulosLedExtra(raw: unknown): ModuloLedExtra[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item): ModuloLedExtra => {
      const row = (item ?? {}) as Record<string, unknown>;
      return {
        cct: String(row.cct ?? "").replace(/\D/g, ""),
        modelo: String(row.modelo ?? "").trim(),
        qtd: Math.max(0.01, Number(row.qtd) || 1),
      };
    });
  } catch {
    return [];
  }
}

const emptyOutroEquipamento = emptyOtherEquipment;

interface FormData {
  categoria: string;
  instalacao: string;
  familia: string;
  sku: string;
  produto: string;
  moduloLed: string;
  qtdModuloLed: number;
  moduloRgbw: boolean;
  moduloLampada: boolean;
  moduloLedRgbw: string;
  qtdModuloLedRgbw: number;
  moduloTunableWhite: boolean;
  moduloLedTunableWhite: string;
  qtdModuloLedTunableWhite: number;
  semModuloLed: boolean;
  lampadaAcessorioId: number | null;
  // Módulo LED por CCT
  moduloLed2700: string;
  moduloLed3000: string;
  moduloLed3500: string;
  moduloLed4000: string;
  moduloLed5000: string;
  qtdModuloLed2700: number;
  qtdModuloLed3000: number;
  qtdModuloLed3500: number;
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
  driverOnoff220NaoAplicavel: boolean;
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
  possuiOpcaoD1D2: boolean;
  // Corrente de programação do driver (ex: "programar em 350mA")
  correnteDriver: string;
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
  moduloRgbw: false,
  moduloLampada: false,
  moduloLedRgbw: "",
  qtdModuloLedRgbw: 1,
  moduloTunableWhite: false,
  moduloLedTunableWhite: "",
  qtdModuloLedTunableWhite: 1,
  semModuloLed: false,
  lampadaAcessorioId: null,
  // Módulo LED por CCT
  moduloLed2700: "",
  moduloLed3000: "",
  moduloLed3500: "",
  moduloLed4000: "",
  moduloLed5000: "",
  qtdModuloLed2700: 1,
  qtdModuloLed3000: 1,
  qtdModuloLed3500: 1,
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
  driverOnoff220NaoAplicavel: false,
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
  temperaturasCor: ["2700", "3000", "3500", "4000", "5000"],
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
  possuiOpcaoD1D2: false,
  correnteDriver: "",
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

/**
 * Infere a corrente de programação do driver com base no produto, família e módulo LED.
 * Retorna null para produtos com FITA LED ou sem driver.
 */
function inferirCorrenteDriver({
  produto,
  familia,
  moduloLed,
  semDriver,
}: {
  produto: string;
  familia: string;
  moduloLed: string;
  semDriver: boolean;
}): string | null {
  const prod = produto.toUpperCase();
  const fam  = familia.toUpperCase();
  const mod  = moduloLed.toUpperCase();

  // FITA LED ou SEM DRIVER não têm corrente de programação
  if (semDriver) return null;
  if (mod.includes("FITA LED") || mod.includes("FITA")) return null;

  // ── PERFIS ──────────────────────────────────────────────────────────────────
  // Perfis 18W → 350mA
  if (fam.includes("PERFIL") || prod.includes("PERFIL")) {
    // Stripline
    if (prod.includes("STRIPLINE") || prod.includes("STRIP LINE")) {
      // 36W Stripline → 250mA
      if (prod.includes("36W") || prod.includes("36 W")) return "programar em 250mA";
      // Outros Stripline → 350mA
      return "programar em 350mA";
    }
    // Barra dupla 36W → 350mA
    if ((prod.includes("36W") || prod.includes("36 W")) && prod.includes("BARRA DUPLA")) return "programar em 350mA";
    // 18W → 350mA
    if (prod.includes("18W") || prod.includes("18 W")) return "programar em 350mA";
    // 26W → 500mA
    if (prod.includes("26W") || prod.includes("26 W")) return "programar em 500mA";
    // 36W genérico → 350mA
    if (prod.includes("36W") || prod.includes("36 W")) return "programar em 350mA";
  }

  // ── LUMINÁRIAS COM LED COB ────────────────────────────────────────────────
  if (mod.includes("COB") || prod.includes("COB")) {
    if (prod.includes("13W") || prod.includes("13 W")) return "programar em 350mA";
    if (prod.includes("18W") || prod.includes("18 W")) return "programar em 500mA";
    if (prod.includes("26W") || prod.includes("26 W")) return "programar em 700mA";
    if (prod.includes("38W") || prod.includes("38 W")) return "programar em 1050mA";
  }

  // ── LUX ROUND ─────────────────────────────────────────────────────────────
  if (prod.includes("LUX ROUND")) {
    // Ø80 36 LEDS → 350mA
    if (prod.includes("Ø80") || prod.includes("80MM") || prod.includes("80 MM")) return "programar em 350mA";
    // Ø120 54 LEDS → 350mA
    if ((prod.includes("Ø120") || prod.includes("120MM") || prod.includes("120 MM")) && prod.includes("54")) return "programar em 350mA";
    // Ø120 120 LED: 26W → 350mA, 36W → 500mA
    if ((prod.includes("Ø120") || prod.includes("120MM") || prod.includes("120 MM")) && prod.includes("120")) {
      if (prod.includes("26W") || prod.includes("26 W")) return "programar em 350mA";
      if (prod.includes("36W") || prod.includes("36 W")) return "programar em 500mA";
    }
  }

  // ── MÓDULOS Ø50 e Ø67mm ──────────────────────────────────────────────────
  if (mod.includes("Ø50") || mod.includes("50MM") || mod.includes("50 MM") ||
      mod.includes("Ø67") || mod.includes("67MM") || mod.includes("67 MM") ||
      prod.includes("Ø50") || prod.includes("Ø67")) {
    return "programar em 350mA";
  }

  // ── PAINÉIS COM STRIPFLEX ────────────────────────────────────────────────
  if (mod.includes("STRIPFLEX") || prod.includes("STRIPFLEX")) {
    if (prod.includes("26W") || prod.includes("26 W")) return "programar em 500mA";
    // 9W, 18W, 36W → 350mA
    return "programar em 350mA";
  }

  return null;
}

export default function ProductForm({ editId, duplicarDeId, onSuccess }: ProductFormProps) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canEditCosts = user ? can(user.role, "editCosts", user.permissionOverrides) : false;
  const [form, setForm] = useState<FormData>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormData, boolean>>>({});
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<ProductDocuments>({});
  const [documentViewUrls, setDocumentViewUrls] = useState<Partial<Record<ProductDocumentType, string>>>({});
  const [uploadingDocument, setUploadingDocument] = useState<ProductDocumentType | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [produtoOriginalNome, setProdutoOriginalNome] = useState<string | null>(null);
  const [driversExtra, setDriversExtra] = useState<DriversExtraState>(defaultDriversExtra);
  const [oticasExtra, setOticasExtra] = useState<OticaExtra[]>([]);
  const [modulosLedExtra, setModulosLedExtra] = useState<ModuloLedExtra[]>([]);
  const [outrosEquipamentos, setOutrosEquipamentos] = useState<OutroEquipamento[]>([]);
  const [showSemDriverDialog, setShowSemDriverDialog] = useState(false);
  const [d1d2Drivers, setD1d2Drivers] = useState<D1D2DriversState>(emptyD1D2DriversState());
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Keep a ref that always points to the latest form state so validate()
  // never reads a stale closure value
  const formRef = useRef<FormData>(form);
  useEffect(() => { formRef.current = form; }, [form]);
  // Flag to ensure the form is only initialized once from the server data,
  // preventing tRPC re-fetches from overwriting user edits
  const initializedRef = useRef(false);
  // Flag que indica se o usuário editou manualmente o campo correnteDriver.
  // Quando true, a auto-inferência não sobrescreve o valor do usuário.
  // É resetada para false ao inicializar o formulário com dados do banco.
  const correnteEditadaManualmenteRef = useRef(false);
  const isEdit = !!editId;
  const isDuplicate = !!duplicarDeId;
  const cctDisabled = form.moduloRgbw || form.moduloLampada || form.moduloTunableWhite || form.semModuloLed;

  const { data: allComponents = [] } = trpc.components.list.useQuery(undefined, { staleTime: 60_000 });

  useEffect(() => {
    if (allComponents.length === 0) return;
    setOutrosEquipamentos((current) => hydrateOtherEquipmentRecords(current, allComponents));
  }, [allComponents]);

  // Load existing product for edit OR for duplication
  const loadId = editId ?? duplicarDeId;
  const { data: existingProduct } = trpc.products.getById.useQuery(
    { id: loadId! },
    { enabled: !!loadId, staleTime: Infinity, refetchOnWindowFocus: false }
  );

  useEffect(() => {
    if (existingProduct && !initializedRef.current) {
      initializedRef.current = true;
      const temps = (() => {
        try { return JSON.parse(existingProduct.temperaturasCor || "[]"); }
        catch { return ["2700", "3000", "3500", "4000", "5000"]; }
      })();
      const p = existingProduct as any;
      setDocuments(parseProductDocuments(p.documentos));
      setDocumentViewUrls(getProductDocumentViewUrls(p.documentosVisualizacao));
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
        moduloLed3500: p.moduloLed3500 || "",
        moduloLed4000: p.moduloLed4000 || "",
        moduloLed5000: p.moduloLed5000 || "",
        qtdModuloLed2700: (p.qtdModuloLed2700 != null ? Number(p.qtdModuloLed2700) : 1),
        qtdModuloLed3000: (p.qtdModuloLed3000 != null ? Number(p.qtdModuloLed3000) : 1),
        qtdModuloLed3500: (p.qtdModuloLed3500 != null ? Number(p.qtdModuloLed3500) : 1),
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
        driverOnoff220NaoAplicavel: existingProduct.driverOnoff220NaoAplicavel || false,
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
        possuiOpcaoD1D2: !!(p as any).possuiOpcaoD1D2,
        precoVendaOnoff220D1: (p as any).precoVendaOnoff220D1 ? String((p as any).precoVendaOnoff220D1) : "",
        precoVendaOnoff220D1D2: (p as any).precoVendaOnoff220D1D2 ? String((p as any).precoVendaOnoff220D1D2) : "",
        precoVendaOnoffBivoltD1: (p as any).precoVendaOnoffBivoltD1 ? String((p as any).precoVendaOnoffBivoltD1) : "",
        precoVendaOnoffBivoltD1D2: (p as any).precoVendaOnoffBivoltD1D2 ? String((p as any).precoVendaOnoffBivoltD1D2) : "",
        precoVendaDim110vD1: (p as any).precoVendaDim110vD1 ? String((p as any).precoVendaDim110vD1) : "",
        precoVendaDim110vD1D2: (p as any).precoVendaDim110vD1D2 ? String((p as any).precoVendaDim110vD1D2) : "",
        precoVendaDimDaliD1: (p as any).precoVendaDimDaliD1 ? String((p as any).precoVendaDimDaliD1) : "",
        precoVendaDimDaliD1D2: (p as any).precoVendaDimDaliD1D2 ? String((p as any).precoVendaDimDaliD1D2) : "",
        correnteDriver: (p as any).correnteDriver || "",
        moduloRgbw: !!(p as any).moduloRgbw,
        moduloLampada: !!(p as any).moduloLampada,
        moduloLedRgbw: (p as any).moduloLedRgbw || "",
        qtdModuloLedRgbw: (p as any).qtdModuloLedRgbw ? Number((p as any).qtdModuloLedRgbw) : 1,
        moduloTunableWhite: Boolean((p as any).moduloTunableWhite),
        moduloLedTunableWhite: (p as any).moduloLedTunableWhite || "",
        qtdModuloLedTunableWhite: (p as any).qtdModuloLedTunableWhite ? Number((p as any).qtdModuloLedTunableWhite) : 1,
        semModuloLed: Boolean((p as any).semModuloLed),
        lampadaAcessorioId: (p as any).lampadaAcessorioId ? Number((p as any).lampadaAcessorioId) : null,
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
        try {
          const parsed = JSON.parse(raw) as DriverExtra[];
          // Normalize null custo to empty string to avoid React controlled input warning
          return parsed.map(d => ({ ...d, custo: d.custo ?? "", modelo: d.modelo ?? "", qtd: d.qtd ?? 1 }));
        } catch { return []; }
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
      setModulosLedExtra(parseModulosLedExtra((p as any).moduloLedExtra));
      setOutrosEquipamentos(hydrateOtherEquipmentRecords(
        parseStoredOtherEquipment((p as any).outrosEquipamentos),
        allComponents,
      ));

      // Carregar composição D1+D2 se existir
      const parseComposicaoD1D2 = (raw: any): D1D2DriversState => {
        const empty = emptyD1D2DriversState();
        if (!raw) return empty;
        try {
          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
          if (Array.isArray(parsed?.drivers)) {
            for (const d of parsed.drivers) {
              if (d.tipo === "DRIVER_ONOFF_220") empty.onoff220 = { modelo: d.modelo || "", qtd: d.qtd || 1, custo: d.custo || "" };
              else if (d.tipo === "DRIVER_ONOFF_BIVOLT") empty.onoffBivolt = { modelo: d.modelo || "", qtd: d.qtd || 1, custo: d.custo || "" };
              else if (d.tipo === "DRIVER_DIM_110V") empty.dim110v = { modelo: d.modelo || "", qtd: d.qtd || 1, custo: d.custo || "" };
              else if (d.tipo === "DRIVER_DIM_DALI") empty.dimDali = { modelo: d.modelo || "", qtd: d.qtd || 1, custo: d.custo || "" };
              else if (d.tipo === "DRIVER_DIM_TRIAC_110V") empty.dimTriac110v = { modelo: d.modelo || "", qtd: d.qtd || 1, custo: d.custo || "" };
              else if (d.tipo === "DRIVER_DIM_TRIAC_220V") empty.dimTriac220v = { modelo: d.modelo || "", qtd: d.qtd || 1, custo: d.custo || "" };
            }
          }
          return empty;
        } catch { return empty; }
      };
      setD1d2Drivers(parseComposicaoD1D2((p as any).composicaoD1D2));

      if (isDuplicate) {
        // When duplicating: keep SKU (same SKU can have multiple variants), clear only PRODUTO
        setProdutoOriginalNome(existingProduct.produto || existingProduct.sku || "produto");
        setForm({ ...baseForm, produto: "" });
        setPhotoPreview(existingProduct.fotoUrl || null);
      } else {
        setForm(baseForm);
        if (existingProduct.fotoUrl) setPhotoPreview(existingProduct.fotoUrl);
      }
      // Ao carregar produto existente, verificar se o valor salvo no banco
      // é diferente do que seria inferido automaticamente.
      // Se for diferente, significa que o usuário editou manualmente → preservar.
      const correnteSalva = (p as any).correnteDriver || "";
      const correnteQueSeriaInferida = inferirCorrenteDriver({
        produto: (p as any).produto || "",
        familia: (p as any).familia || "",
        moduloLed: (p as any).moduloLed || "",
        semDriver: Boolean((p as any).semDriver),
      });
      // Se o valor salvo é diferente do inferido, o usuário editou manualmente
      correnteEditadaManualmenteRef.current = correnteSalva !== (correnteQueSeriaInferida ?? "");
    }
    }, [existingProduct, isDuplicate]);

  // ── Helper: limpar todos os campos de driver ──
  const clearAllDriverFields = () => {
    setForm((prev) => ({
      ...prev,
      driverOnoff220: "", qtdDriverOnoff220: 1, driverOnoff220NaoAplicavel: false, custoDriverOnoff220: "",
      driverOnoffBivolt: "", qtdDriverOnoffBivolt: 1, driverOnoffBivoltNaoAplicavel: false, custoDriverOnoffBivolt: "",
      driverDim110v: "", qtdDriverDim110v: 1, driverDim110vNaoAplicavel: false, custoDriverDim110v: "",
      driverDimDali: "", qtdDriverDimDali: 1, driverDimDaliNaoAplicavel: false, custoDriverDimDali: "",
      driverDimTriac110v: "", qtdDriverDimTriac110v: 1, driverDimTriac110vNaoAplicavel: false, custoDriverDimTriac110v: "",
      driverDimTriac220v: "", qtdDriverDimTriac220v: 1, driverDimTriac220vNaoAplicavel: false, custoDriverDimTriac220v: "",
      correnteDriver: "",
      mkpPadraoDriverOnoff220v: "", mkpPadraoDriverOnoffBivolt: "",
      mkpPadraoDriverDim110v: "", mkpPadraoDriverDimDali: "",
      mkpPadraoDriverDimTriac110v: "", mkpPadraoDriverDimTriac220v: "",
    }));
    setDriversExtra(defaultDriversExtra);
  };

  // ── Quando Luminária com Lâmpada ativa: forçar SEM DRIVER, limpar temperaturas e drivers ──
  useEffect(() => {
    if (form.moduloLampada) {
      setForm((prev) => ({
        ...prev,
        semDriver: true,
        temperaturasCor: [],
      }));
      clearAllDriverFields();
    }
  }, [form.moduloLampada]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Quando SEM DRIVER ativado: limpar todos os campos de driver ──
  const prevSemDriverRef = useRef(false);
  useEffect(() => {
    // Só limpa quando o usuário ATIVA o semDriver (false → true), não no carregamento inicial
    if (form.semDriver && !prevSemDriverRef.current && initializedRef.current) {
      clearAllDriverFields();
    }
    prevSemDriverRef.current = form.semDriver;
  }, [form.semDriver]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-inferir corrente do driver quando produto/família/módulo/semDriver mudam ──
  // Só sobrescreve se o formulário já foi inicializado (evita apagar valor salvo no banco
  // durante o carregamento inicial) E se o usuário não editou manualmente o campo.
  useEffect(() => {
    // Aguarda inicialização do formulário para não sobrescrever valor do banco
    if ((isEdit || isDuplicate) && !initializedRef.current) return;
    // Se o usuário editou manualmente, não sobrescreve
    if (correnteEditadaManualmenteRef.current) return;
    const corrente = inferirCorrenteDriver({
      produto: form.produto,
      familia: form.familia,
      moduloLed: form.moduloLed,
      semDriver: form.semDriver,
    });
    setForm((prev) => ({ ...prev, correnteDriver: corrente ?? "" }));
  }, [form.produto, form.familia, form.moduloLed, form.semDriver, isEdit, isDuplicate]);

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
      if (editId) utils.products.getById.invalidate({ id: editId });
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
            if (field === "driverOnoff220" && f.driverOnoff220NaoAplicavel) continue;
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
      if (field === "driverOnoff220" && form.driverOnoff220NaoAplicavel) continue;
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

  const toggleLightingMode = (field: "moduloRgbw" | "moduloLampada" | "moduloTunableWhite" | "semModuloLed") => {
    setForm((previous) => {
      const willActivate = !previous[field];
      return {
        ...previous,
        moduloRgbw: false,
        moduloLampada: false,
        moduloTunableWhite: false,
        semModuloLed: false,
        [field]: willActivate,
        lampadaAcessorioId: field === "moduloLampada" && willActivate ? previous.lampadaAcessorioId : null,
      };
    });
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

  const handleDocumentUpload = async (tipo: ProductDocumentType, file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const allowed: Record<ProductDocumentType, string[]> = {
      datasheet: ["pdf"],
      fotometria: ["ies"],
      desenhoTecnico: ["pdf", "dwg", "dxf", "png", "jpg", "jpeg"],
      manualInstalacao: ["pdf"],
    };
    if (!allowed[tipo].includes(ext)) {
      toast.error(`Formato inválido para ${DOCUMENT_CONFIG[tipo].label}. Use ${DOCUMENT_CONFIG[tipo].hint}.`);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("O documento deve ter no máximo 25 MB.");
      return;
    }

    setUploadingDocument(tipo);
    try {
      const fd = new FormData();
      fd.append("tipo", tipo);
      fd.append("file", file);
      const res = await fetch("/api/products/upload-document", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.documento) throw new Error(data.error || "Erro ao enviar documento");
      setDocuments((prev) => ({ ...prev, [tipo]: data.documento as ProductDocument }));
      setDocumentViewUrls((prev) => ({
        ...prev,
        [tipo]: data.documentoVisualizacao?.url || data.documento.url,
      }));
      toast.success(`${DOCUMENT_CONFIG[tipo].label} enviado com sucesso!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar documento");
    } finally {
      setUploadingDocument(null);
    }
  };

  const removeDocument = (tipo: ProductDocumentType) => {
    setDocuments((prev) => {
      const next = { ...prev };
      delete next[tipo];
      return next;
    });
    setDocumentViewUrls((prev) => {
      const next = { ...prev };
      delete next[tipo];
      return next;
    });
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

    const extrasComConteudo = modulosLedExtra.filter((item) => item.cct.trim() || item.modelo.trim());
    const extrasNormalizados = extrasComConteudo.map((item) => ({
      cct: item.cct.replace(/\D/g, ""),
      modelo: item.modelo.trim(),
      qtd: Math.max(0.01, Number(item.qtd) || 1),
    }));
    const cctsExtras = new Set<string>();
    const possuiExtraInvalido = extrasNormalizados.some((item) => {
      const cctNumerico = Number(item.cct);
      const repetido = TEMPERATURAS.includes(item.cct) || cctsExtras.has(item.cct);
      cctsExtras.add(item.cct);
      return !item.cct || !item.modelo || !Number.isInteger(cctNumerico) || cctNumerico < 1000 || cctNumerico > 10000 || repetido;
    });
    if (possuiExtraInvalido) {
      toast.error("Cada CCT adicional deve ter uma temperatura única entre 1000K e 10000K e um módulo LED selecionado");
      return;
    }

    const equipamentosComConteudo = outrosEquipamentos.filter((item) => item.componentId || item.modelo.trim());
    if (equipamentosComConteudo.some((item) => !item.componentId)) {
      toast.error("Selecione um componente cadastrado para cada item de Outros Equipamentos");
      return;
    }
    const equipamentosNormalizados = equipamentosComConteudo.map((item) => ({
      componentId: item.componentId!,
      qtd: Math.max(0.01, Number(item.qtd) || 1),
    }));

    const semCct = form.moduloRgbw || form.moduloLampada || form.moduloTunableWhite || form.semModuloLed;

    // Derivar temperaturasCor automaticamente dos módulos CCT preenchidos
    const hasCctModules = !!(form.moduloLed2700 || form.moduloLed3000 || form.moduloLed3500 || form.moduloLed4000 || form.moduloLed5000 || extrasNormalizados.length);
    const derivedTemps = hasCctModules
      ? [
          ...(form.moduloLed2700 ? ["2700"] : []),
          ...(form.moduloLed3000 ? ["3000"] : []),
          ...(form.moduloLed3500 ? ["3500"] : []),
          ...(form.moduloLed4000 ? ["4000"] : []),
          ...(form.moduloLed5000 ? ["5000"] : []),
          ...extrasNormalizados.map((item) => item.cct),
        ]
      : form.temperaturasCor;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = {
      ...form,
      semDriver: form.semDriver,
      moduloRgbw: form.moduloRgbw ? 1 : 0,
      moduloLampada: form.moduloLampada ? 1 : 0,
      moduloLedRgbw: form.moduloRgbw && form.moduloLedRgbw ? form.moduloLedRgbw : null,
      qtdModuloLedRgbw: form.moduloRgbw && form.moduloLedRgbw ? form.qtdModuloLedRgbw : undefined,
      moduloTunableWhite: form.moduloTunableWhite,
      moduloLedTunableWhite: form.moduloTunableWhite && form.moduloLedTunableWhite ? form.moduloLedTunableWhite : null,
      qtdModuloLedTunableWhite: form.moduloTunableWhite && form.moduloLedTunableWhite ? form.qtdModuloLedTunableWhite : undefined,
      semModuloLed: form.semModuloLed,
      lampadaAcessorioId: form.moduloLampada ? form.lampadaAcessorioId : null,
      outrosEquipamentos: equipamentosNormalizados.length > 0 ? JSON.stringify(equipamentosNormalizados) : null,
      moduloLed: semCct ? "" : form.moduloLed,
      temperaturasCor: form.moduloRgbw ? JSON.stringify(["RGBW"]) : semCct ? JSON.stringify([]) : JSON.stringify(derivedTemps),
      moduloLed2700: !semCct && form.moduloLed2700 !== "" ? form.moduloLed2700 : null,
      moduloLed3000: !semCct && form.moduloLed3000 !== "" ? form.moduloLed3000 : null,
      moduloLed3500: !semCct && form.moduloLed3500 !== "" ? form.moduloLed3500 : null,
      moduloLed4000: !semCct && form.moduloLed4000 !== "" ? form.moduloLed4000 : null,
      moduloLed5000: !semCct && form.moduloLed5000 !== "" ? form.moduloLed5000 : null,
      moduloLedExtra: semCct || extrasNormalizados.length === 0 ? null : JSON.stringify(extrasNormalizados),
      qtdModuloLed2700: !semCct && form.moduloLed2700 ? form.qtdModuloLed2700 : undefined,
      qtdModuloLed3000: !semCct && form.moduloLed3000 ? form.qtdModuloLed3000 : undefined,
      qtdModuloLed3500: !semCct && form.moduloLed3500 ? form.qtdModuloLed3500 : undefined,
      qtdModuloLed4000: !semCct && form.moduloLed4000 ? form.qtdModuloLed4000 : undefined,
      qtdModuloLed5000: !semCct && form.moduloLed5000 ? form.qtdModuloLed5000 : undefined,
      custoLuminaria: form.custoLuminaria || undefined,
      // Custo do corpo por tipo de driver — envia null explicitamente para permitir zerar
      custoCorpoOnoff220v: form.custoCorpoOnoff220v !== "" ? form.custoCorpoOnoff220v : null,
      custoCorpoOnoffBivolt: form.custoCorpoOnoffBivolt !== "" ? form.custoCorpoOnoffBivolt : null,
      custoCorpoDim110v: form.custoCorpoDim110v !== "" ? form.custoCorpoDim110v : null,
      custoCorpoDimDali: form.custoCorpoDimDali !== "" ? form.custoCorpoDimDali : null,
      custoCorpoDimTriac110v: form.custoCorpoDimTriac110v !== "" ? form.custoCorpoDimTriac110v : null,
      custoCorpoDimTriac220v: form.custoCorpoDimTriac220v !== "" ? form.custoCorpoDimTriac220v : null,
      // Markup padrão por tipo de driver
      mkpPadraoOnoff220v: form.mkpPadraoOnoff220v || undefined,
      mkpPadraoOnoffBivolt: form.mkpPadraoOnoffBivolt || undefined,
      mkpPadraoDim110v: form.mkpPadraoDim110v || undefined,
      mkpPadraoDimDali: form.mkpPadraoDimDali || undefined,
      mkpPadraoDimTriac110v: form.mkpPadraoDimTriac110v || undefined,
      mkpPadraoDimTriac220v: form.mkpPadraoDimTriac220v || undefined,
      // Markup mínimo por tipo de driver — apenas admin pode alterar
      ...(canEditCosts ? {
        mkpMinimoOnoff220v: form.mkpMinimoOnoff220v || undefined,
        mkpMinimoOnoffBivolt: form.mkpMinimoOnoffBivolt || undefined,
        mkpMinimoDim110v: form.mkpMinimoDim110v || undefined,
        mkpMinimoDimDali: form.mkpMinimoDimDali || undefined,
        mkpMinimoDimTriac110v: form.mkpMinimoDimTriac110v || undefined,
        mkpMinimoDimTriac220v: form.mkpMinimoDimTriac220v || undefined,
      } : {}),
      // Custo D1+D2 — envia null explicitamente para permitir zerar
      custoCorpoOnoff220vD1D2: form.custoCorpoOnoff220vD1D2 !== "" ? form.custoCorpoOnoff220vD1D2 : null,
      custoCorpoOnoffBivoltD1D2: form.custoCorpoOnoffBivoltD1D2 !== "" ? form.custoCorpoOnoffBivoltD1D2 : null,
      custoCorpoDim110vD1D2: form.custoCorpoDim110vD1D2 !== "" ? form.custoCorpoDim110vD1D2 : null,
      custoCorpoDimDaliD1D2: form.custoCorpoDimDaliD1D2 !== "" ? form.custoCorpoDimDaliD1D2 : null,
      custoCorpoDimTriac110vD1D2: form.custoCorpoDimTriac110vD1D2 !== "" ? form.custoCorpoDimTriac110vD1D2 : null,
      custoCorpoDimTriac220vD1D2: form.custoCorpoDimTriac220vD1D2 !== "" ? form.custoCorpoDimTriac220vD1D2 : null,
      custoDriverOnoff220: form.custoDriverOnoff220 || undefined,
      custoDriverOnoffBivolt: form.custoDriverOnoffBivolt || undefined,
      custoDriverDim110v: form.custoDriverDim110v || undefined,
      custoDriverDimDali: form.custoDriverDimDali || undefined,
      fotoUrl: form.fotoUrl !== "" ? form.fotoUrl : null,
      fotoKey: form.fotoKey !== "" ? form.fotoKey : null,
      documentos: Object.keys(documents).length > 0 ? JSON.stringify(documents) : null,
      precoVendaOnoff220: form.precoVendaOnoff220 || undefined,
      precoVendaOnoffBivolt: form.precoVendaOnoffBivolt || undefined,
      precoVendaDim110v: form.precoVendaDim110v || undefined,
      precoVendaDimDali: form.precoVendaDimDali || undefined,
      configuracaoPlanos: (form.configuracaoPlanos as "D1" | "D2" | "D1+D2" | undefined) || undefined,
      possuiOpcaoD1D2: form.categoria?.toUpperCase() === "PERFIS" && form.possuiOpcaoD1D2,
      precoVendaOnoff220D1:      form.precoVendaOnoff220D1      || undefined,
      precoVendaOnoff220D1D2:    form.precoVendaOnoff220D1D2    || undefined,
      precoVendaOnoffBivoltD1:   form.precoVendaOnoffBivoltD1   || undefined,
      precoVendaOnoffBivoltD1D2: form.precoVendaOnoffBivoltD1D2 || undefined,
      precoVendaDim110vD1:       form.precoVendaDim110vD1       || undefined,
      precoVendaDim110vD1D2:     form.precoVendaDim110vD1D2     || undefined,
            precoVendaDimDaliD1:     form.precoVendaDimDaliD1     || undefined,
      precoVendaDimDaliD1D2:    form.precoVendaDimDaliD1D2    || undefined,
      correnteDriver: form.correnteDriver || null,
      // Drivers ON/OFF
      driverOnoff220NaoAplicavel: form.driverOnoff220NaoAplicavel,
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

    // Serializar composição D1+D2 como JSON
    if (form.possuiOpcaoD1D2) {
      const validD1D2Drivers: ComposicaoD1D2Driver[] = [];
      if (d1d2Drivers.onoff220.modelo.trim()) validD1D2Drivers.push({ tipo: "DRIVER_ONOFF_220", ...d1d2Drivers.onoff220 });
      if (d1d2Drivers.onoffBivolt.modelo.trim()) validD1D2Drivers.push({ tipo: "DRIVER_ONOFF_BIVOLT", ...d1d2Drivers.onoffBivolt });
      if (d1d2Drivers.dim110v.modelo.trim()) validD1D2Drivers.push({ tipo: "DRIVER_DIM_110V", ...d1d2Drivers.dim110v });
      if (d1d2Drivers.dimDali.modelo.trim()) validD1D2Drivers.push({ tipo: "DRIVER_DIM_DALI", ...d1d2Drivers.dimDali });
      if (d1d2Drivers.dimTriac110v.modelo.trim()) validD1D2Drivers.push({ tipo: "DRIVER_DIM_TRIAC_110V", ...d1d2Drivers.dimTriac110v });
      if (d1d2Drivers.dimTriac220v.modelo.trim()) validD1D2Drivers.push({ tipo: "DRIVER_DIM_TRIAC_220V", ...d1d2Drivers.dimTriac220v });
      const composicao = {
        qtdModuloLed: (form.qtdModuloLed || 1) * 2,
        drivers: validD1D2Drivers,
      };
      payload.composicaoD1D2 = JSON.stringify(composicao);
    } else {
      payload.composicaoD1D2 = null;
    }

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
      (f.driverOnoff220 && f.driverOnoff220.trim() && !f.driverOnoff220NaoAplicavel) ||
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
        {/* ─── Documentos do produto ─────────────────────────────────────── */}
        <section className="alfalux-card p-4">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <h2 className="section-header mb-0">DOCUMENTOS DO PRODUTO</h2>
            </div>
            <span className="text-[10px] text-muted-foreground">Opcionais · máximo 25 MB por arquivo</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {(Object.keys(DOCUMENT_CONFIG) as ProductDocumentType[]).map((tipo) => {
              const config = DOCUMENT_CONFIG[tipo];
              const document = documents[tipo];
              const isUploading = uploadingDocument === tipo;
              const Icon = tipo === "datasheet" ? FileText : tipo === "fotometria" ? FileCode2 : tipo === "desenhoTecnico" ? Ruler : BookOpen;

              return (
                <div key={tipo} className={cn(
                  "rounded-lg border px-3 py-2.5 transition-colors",
                  document ? "border-primary/35 bg-primary/5" : "border-border/60 bg-muted/10"
                )}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn(
                      "w-9 h-9 rounded-md flex-shrink-0 flex items-center justify-center border",
                      document ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted/20 text-muted-foreground"
                    )}>
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-extrabold tracking-wider text-primary">{config.sigla}</span>
                        <span className="text-xs font-semibold text-foreground truncate">{config.label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate" title={document?.nome}>
                        {document?.nome || config.hint}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mt-2">
                    {document && (
                      <a
                        href={isEdit && editId ? `/api/products/${editId}/document/${tipo}` : (documentViewUrls[tipo] || document.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="h-7 px-2 rounded border border-border text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 inline-flex items-center gap-1"
                        title="Abrir documento"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Abrir
                      </a>
                    )}
                    <label className={cn(
                      "h-7 px-2.5 rounded border border-primary/40 text-[10px] font-semibold text-primary hover:bg-primary/10 inline-flex items-center justify-center cursor-pointer transition-colors",
                      isUploading && "opacity-50 pointer-events-none"
                    )}>
                      <Upload className="w-3 h-3 mr-1" />
                      {document ? "Substituir" : "Anexar"}
                      <input
                        type="file"
                        className="hidden"
                        accept={config.accept}
                        disabled={isUploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void handleDocumentUpload(tipo, file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    {document && (
                      <button
                        type="button"
                        onClick={() => removeDocument(tipo)}
                        className="h-7 w-7 rounded border border-destructive/30 text-destructive/80 hover:bg-destructive/10 inline-flex items-center justify-center transition-colors"
                        title={`Remover ${config.label}`}
                        aria-label={`Remover ${config.label}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

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

            {form.categoria?.toUpperCase() === "PERFIS" && (
              <div className="md:col-span-2 lg:col-span-3 xl:col-span-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <Checkbox
                  id="possuiOpcaoD1D2"
                  checked={form.possuiOpcaoD1D2}
                  onCheckedChange={(checked) => setField("possuiOpcaoD1D2", checked === true)}
                  className="mt-0.5 border-amber-400 data-[state=checked]:bg-amber-500 data-[state=checked]:text-black"
                />
                <label htmlFor="possuiOpcaoD1D2" className="cursor-pointer">
                  <span className="block text-sm font-semibold text-foreground">Este perfil possui opção D1 + D2</span>
                  <span className="block mt-1 text-xs text-muted-foreground">
                    Informe ao Configurador que este perfil também pode usar D1 + D2, com quantidades de barras e drivers definidas pela regra do Configurador.
                  </span>
                </label>
              </div>
            )}
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
              <div className="flex flex-col gap-3 mb-3 xl:flex-row xl:items-center xl:justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">MÓDULO LED</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleLightingMode("moduloRgbw")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all",
                      form.moduloRgbw
                        ? "bg-purple-600/20 border-purple-500 text-purple-300"
                        : "border-border text-muted-foreground hover:border-purple-500/50 hover:text-purple-400"
                    )}
                    title="Placa RGBW — desabilita os campos de CCT"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    RGBW
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleLightingMode("moduloTunableWhite")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                      form.moduloTunableWhite
                        ? "bg-cyan-600/20 border-cyan-500 text-cyan-300"
                        : "border-border text-muted-foreground hover:border-cyan-500/50 hover:text-cyan-400"
                    )}
                    title="Módulo Tunable White — modalidade específica sem CCT"
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                    Tunable White
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleLightingMode("moduloLampada")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                      form.moduloLampada
                        ? "bg-amber-600/20 border-amber-500 text-amber-300"
                        : "border-border text-muted-foreground hover:border-amber-500/50 hover:text-amber-400"
                    )}
                    title="Luminária com lâmpada — desabilita os campos de CCT"
                  >
                    <Lightbulb className="h-3.5 w-3.5" />
                    LUM. C/ LÂMPADA
                  </button>
                  <label
                    htmlFor="sem-modulo-led"
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                      form.semModuloLed
                        ? "bg-slate-500/20 border-slate-400 text-slate-200"
                        : "border-border text-muted-foreground hover:border-slate-400/60 hover:text-slate-300"
                    )}
                    title="Produto sem módulo LED — a API omitirá dados de módulo"
                  >
                    <Checkbox
                      id="sem-modulo-led"
                      checked={form.semModuloLed}
                      onCheckedChange={() => toggleLightingMode("semModuloLed")}
                      className="h-3.5 w-3.5 border-current data-[state=checked]:bg-slate-200 data-[state=checked]:text-slate-900"
                    />
                    Sem módulo LED
                  </label>
                  {!cctDisabled && (
                    <span className="text-[10px] text-muted-foreground">Preencha o módulo para cada CCT disponível — CCT sem módulo será desabilitado</span>
                  )}
                </div>
              </div>
              {/* Campo de módulo RGBW */}
              {form.moduloRgbw && (
                <div className="mb-3 p-3 rounded-md bg-purple-500/10 border border-purple-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-purple-300">🟣 Módulo RGBW</span>
                    <span className="text-[10px] text-muted-foreground">— CCTs desabilitados</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <div className="flex-1 min-w-0">
                      <ComponentSelect
                        tipo="MODULO_LED"
                        value={form.moduloLedRgbw}
                        onChange={(v) => setField("moduloLedRgbw", v)}
                        placeholder="Selecione o módulo RGBW..."
                        hasError={false}
                        onlyActive
                      />
                    </div>
                    {form.moduloLedRgbw && (
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">QTD</span>
                        <Input
                          className="input-dark text-sm text-center px-2 w-16"
                          type="number"
                          min="0.01"
                          max="999"
                          step="0.01"
                          value={form.qtdModuloLedRgbw ?? 1}
                          onChange={(e) => {
                            const raw = e.target.value.replace(',', '.');
                            const parsed = parseFloat(raw);
                            setField("qtdModuloLedRgbw", isNaN(parsed) ? 1 : Math.max(0.01, Math.round(parsed * 1000) / 1000));
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              {form.moduloTunableWhite && (
                <div className="mb-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-cyan-300" />
                    <span className="text-xs font-semibold text-cyan-300">Módulo Tunable White</span>
                    <span className="text-[10px] text-muted-foreground">CCT e RGBW não se aplicam</span>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <ComponentSelect
                        tipo="MODULO_LED"
                        value={form.moduloLedTunableWhite}
                        onChange={(value) => setField("moduloLedTunableWhite", value)}
                        placeholder="Selecione o módulo Tunable White..."
                        onlyActive
                      />
                    </div>
                    {form.moduloLedTunableWhite && (
                      <div className="w-full sm:w-20">
                        <Label className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">Qtd.</Label>
                        <Input
                          className="input-dark text-center"
                          type="number"
                          min="0.01"
                          max="999"
                          step="0.01"
                          value={form.qtdModuloLedTunableWhite}
                          onChange={(event) => setField("qtdModuloLedTunableWhite", Math.max(0.01, Number(event.target.value) || 1))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
              {form.moduloLampada && (
                <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-300" />
                    <span className="text-xs font-semibold text-amber-300">Luminária com Lâmpada</span>
                    <span className="text-[10px] text-muted-foreground">Seleção opcional em Acessórios</span>
                  </div>
                  <AccessorySelect
                    value={form.lampadaAcessorioId}
                    onChange={(value) => setField("lampadaAcessorioId", value)}
                    placeholder="Selecione a lâmpada, se aplicável..."
                  />
                </div>
              )}
              {form.semModuloLed && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-slate-500/30 bg-slate-500/10 px-3 py-2.5">
                  <Ban className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Produto sem módulo LED específico</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Os campos de módulo e CCT serão omitidos da API. Outros Equipamentos continuam disponíveis.</p>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-3">
                {([
                  { cct: "2700", field: "moduloLed2700" as const, qtdField: "qtdModuloLed2700" as const, color: "oklch(0.75 0.15 65)" },
                  { cct: "3000", field: "moduloLed3000" as const, qtdField: "qtdModuloLed3000" as const, color: "oklch(0.80 0.12 75)" },
                  { cct: "3500", field: "moduloLed3500" as const, qtdField: "qtdModuloLed3500" as const, color: "oklch(0.82 0.10 85)" },
                  { cct: "4000", field: "moduloLed4000" as const, qtdField: "qtdModuloLed4000" as const, color: "oklch(0.85 0.05 200)" },
                  { cct: "5000", field: "moduloLed5000" as const, qtdField: "qtdModuloLed5000" as const, color: "oklch(0.88 0.04 220)" },
                ] as const).map(({ cct, field, qtdField, color }) => (
                  <div key={cct} className={cn("flex gap-3 items-center", cctDisabled && "opacity-40 pointer-events-none")}>
                    <div
                      className="flex-shrink-0 w-14 text-center text-xs font-bold rounded-md px-2 py-1.5 border"
                      style={{ borderColor: color, color, backgroundColor: `${color}15` }}
                    >
                      {cct}K
                    </div>
                    <div className="flex-1 min-w-0">
                      {cctDisabled ? (
                        <Input className="input-dark opacity-50" value="NÃO APLICÁVEL" disabled readOnly />
                      ) : (
                        <ComponentSelect
                          tipo="MODULO_LED"
                          value={form[field]}
                          onChange={(v) => setField(field, v)}
                          placeholder={`Módulo ${cct}K (deixe vazio para desabilitar)`}
                          hasError={false}
                        />
                      )}
                    </div>
                    {form[field] && !cctDisabled && (
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
                {!cctDisabled && (
                  <div className="mt-1 rounded-lg border border-dashed border-primary/35 bg-primary/5 p-3 space-y-3">
                    {modulosLedExtra.map((item, index) => (
                      <div key={index} className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-1.5 w-full sm:w-32 flex-shrink-0">
                          <Input
                            aria-label={`CCT adicional ${index + 1}`}
                            className="input-dark text-sm text-center px-2"
                            type="number"
                            min="1000"
                            max="10000"
                            step="1"
                            value={item.cct}
                            placeholder="CCT"
                            onChange={(e) => setModulosLedExtra((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, cct: e.target.value.replace(/\D/g, "") } : row))}
                          />
                          <span className="text-xs font-semibold text-primary">K</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <ComponentSelect
                            tipo="MODULO_LED"
                            value={item.modelo}
                            onChange={(modelo) => setModulosLedExtra((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, modelo } : row))}
                            placeholder="Selecione o módulo LED para este CCT..."
                            hasError={false}
                          />
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">QTD</span>
                            <Input
                              aria-label={`Quantidade do CCT adicional ${index + 1}`}
                              className="input-dark text-sm text-center px-2 w-16"
                              type="number"
                              min="0.01"
                              max="999"
                              step="0.01"
                              value={item.qtd}
                              onChange={(e) => {
                                const parsed = parseFloat(e.target.value.replace(',', '.'));
                                setModulosLedExtra((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, qtd: isNaN(parsed) ? 1 : Math.max(0.01, Math.round(parsed * 1000) / 1000) } : row));
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setModulosLedExtra((prev) => prev.filter((_, rowIndex) => rowIndex !== index))}
                            className="mt-4 p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Remover CCT adicional"
                            aria-label="Remover CCT adicional"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setModulosLedExtra((prev) => [...prev, emptyModuloLedExtra()])}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Adicionar CCT
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-muted/10 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2">
                  <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-foreground">Outros Equipamentos</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Associe qualquer componente cadastrado. Estes itens serão enviados pela API mesmo quando não houver módulo LED.</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOutrosEquipamentos((current) => [...current, emptyOutroEquipamento()])}
                  className="shrink-0 border-primary/40 text-xs text-primary"
                >
                  <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                  Adicionar equipamento
                </Button>
              </div>

              {outrosEquipamentos.length === 0 ? (
                <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">
                  Nenhum equipamento adicional associado.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {outrosEquipamentos.map((item, index) => (
                    <div key={`${item.componentId ?? "novo"}-${index}`} className="grid gap-3 rounded-lg border border-border/70 bg-background/50 p-3 sm:grid-cols-[minmax(0,1fr)_80px_36px] sm:items-end">
                      <div className="min-w-0">
                        <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">Componente {index + 1}</Label>
                        <ComponentSelect
                          value={item.modelo}
                          onChange={(modelo) => setOutrosEquipamentos((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, componentId: null, modelo, tipo: "" } : row))}
                          onSelectComponent={(component) => setOutrosEquipamentos((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, componentId: component.id, modelo: component.modelo, tipo: component.tipo } : row))}
                          placeholder="Busque qualquer componente cadastrado..."
                          onlyActive
                        />
                        {item.tipo && <p className="mt-1 text-[10px] text-muted-foreground">Tipo: {item.tipo.replaceAll("_", " ")}</p>}
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-[10px] uppercase tracking-wider text-muted-foreground">Qtd.</Label>
                        <Input
                          className="input-dark text-center"
                          type="number"
                          min="0.01"
                          max="999"
                          step="0.01"
                          value={item.qtd}
                          onChange={(event) => setOutrosEquipamentos((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, qtd: Math.max(0.01, Number(event.target.value) || 1) } : row))}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setOutrosEquipamentos((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remover equipamento ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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

          {/* Campo: Corrente do Driver (auto-preenchido, oculto para FITA LED e SEM DRIVER) */}
          {!form.semDriver && (() => {
            const isFitaLed = form.moduloLed.toUpperCase().includes("FITA");
            if (isFitaLed) return null;
            const isFonte24v = [
              form.driverOnoff220, form.driverOnoffBivolt,
              form.driverDim110v, form.driverDimDali,
              form.driverDimTriac110v, form.driverDimTriac220v,
            ].some((d) => d && d.toUpperCase().includes("FONTE 24V"));
            if (isFonte24v) return null;
            return (
              <div className="mb-5 p-4 rounded-lg border border-blue-500/30 bg-blue-500/5">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Corrente do Driver</span>
                  <span className="text-[10px] text-muted-foreground ml-1">(preenchida automaticamente — editável)</span>
                </div>
                <Input
                  value={form.correnteDriver}
                  onChange={(e) => {
                    correnteEditadaManualmenteRef.current = true;
                    setForm((prev) => ({ ...prev, correnteDriver: e.target.value }));
                  }}
                  placeholder="ex: programar em 350mA"
                  className="font-mono text-sm text-blue-300 bg-blue-900/20 border-blue-500/30 placeholder:text-muted-foreground/40 focus-visible:ring-blue-500/40"
                />
              </div>
            );
          })()}

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

            {/* ON/OFF 220Vac — opcional (com NÃO APLICÁVEL) */}
            <div className="space-y-2">
              <DriverRow
                driverField="driverOnoff220"
                custoField="custoDriverOnoff220"
                qtdField="qtdDriverOnoff220"
                mkpPadraoDriverField="mkpPadraoDriverOnoff220v"
                naoAplicavelField="driverOnoff220NaoAplicavel"
                label="ON/OFF DRIVER 220Vac"
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
        {/* ─── Seção D1+D2: Componentes da versão D1+D2 ──────────────── */}
        {form.possuiOpcaoD1D2 && (
          <section className="alfalux-card p-6 border-l-4 border-amber-500">
            <div className="flex items-center gap-2 mb-5">
              <Cpu className="w-4 h-4 text-amber-400" />
              <h2 className="section-header mb-0 text-amber-400">COMPONENTES D1 + D2</h2>
              <span className="text-[10px] text-muted-foreground ml-auto">Composição quando o perfil usa iluminação direta + indireta</span>
            </div>

            {/* Módulo LED D1+D2 — quantidade automática */}
            <div className="mb-5 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Módulo LED D1+D2</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Mesmo modelo da versão D1. Quantidade automaticamente dobrada.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">Quantidade:</span>
                  <span className="ml-2 text-lg font-bold text-amber-400">{(form.qtdModuloLed || 1) * 2}</span>
                  <span className="text-xs text-muted-foreground ml-1">barras</span>
                </div>
              </div>
            </div>

            {/* Drivers D1+D2 — cadastro manual */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Drivers D1+D2</span>
                <span className="text-[10px] text-muted-foreground">Mesma estrutura da versão D1 — custo puxado automaticamente do componente</span>
              </div>

              <div className="space-y-4">
                {/* ON/OFF 220V D1+D2 */}
                <D1D2DriverField
                  label="ON/OFF 220V"
                  tipo="DRIVER_ONOFF_220"
                  value={d1d2Drivers.onoff220}
                  onChange={(v) => setD1d2Drivers((prev) => ({ ...prev, onoff220: v }))}
                />
                {/* ON/OFF Bivolt D1+D2 */}
                <D1D2DriverField
                  label="ON/OFF Bivolt"
                  tipo="DRIVER_ONOFF_BIVOLT"
                  value={d1d2Drivers.onoffBivolt}
                  onChange={(v) => setD1d2Drivers((prev) => ({ ...prev, onoffBivolt: v }))}
                />
                {/* DIM 1-10V D1+D2 */}
                <D1D2DriverField
                  label="DIM 1-10V"
                  tipo="DRIVER_DIM_110V"
                  value={d1d2Drivers.dim110v}
                  onChange={(v) => setD1d2Drivers((prev) => ({ ...prev, dim110v: v }))}
                />
                {/* DIM DALI D1+D2 */}
                <D1D2DriverField
                  label="DIM DALI"
                  tipo="DRIVER_DIM_DALI"
                  value={d1d2Drivers.dimDali}
                  onChange={(v) => setD1d2Drivers((prev) => ({ ...prev, dimDali: v }))}
                />
                {/* DIM TRIAC 110V D1+D2 */}
                <D1D2DriverField
                  label="DIM TRIAC 110V"
                  tipo="DRIVER_DIM_TRIAC_110V"
                  value={d1d2Drivers.dimTriac110v}
                  onChange={(v) => setD1d2Drivers((prev) => ({ ...prev, dimTriac110v: v }))}
                />
                {/* DIM TRIAC 220V D1+D2 */}
                <D1D2DriverField
                  label="DIM TRIAC 220V"
                  tipo="DRIVER_DIM_TRIAC_220V"
                  value={d1d2Drivers.dimTriac220v}
                  onChange={(v) => setD1d2Drivers((prev) => ({ ...prev, dimTriac220v: v }))}
                />
              </div>
            </div>
          </section>
        )}

        <section
          aria-disabled={form.moduloLampada || form.moduloTunableWhite || form.semModuloLed}
          className={cn(
            "alfalux-card p-6",
            (form.moduloLampada || form.moduloTunableWhite || form.semModuloLed) && "opacity-50 pointer-events-none select-none",
          )}
        >
          <div className="flex items-center gap-2 mb-5">
            <Thermometer className="w-4 h-4 text-primary" />
            <h2 className="section-header mb-0">TEMPERATURA DE COR</h2>
            {form.semModuloLed ? (
              <span className="text-[10px] text-slate-300 ml-auto">Não aplicável — produto sem módulo LED</span>
            ) : form.moduloLampada ? (
              <span className="text-[10px] text-amber-400 ml-auto">Não aplicável — luminária com lâmpada</span>
            ) : form.moduloTunableWhite ? (
              <span className="text-[10px] text-cyan-300 ml-auto">Não aplicável — módulo Tunable White</span>
            ) : (form.moduloLed2700 || form.moduloLed3000 || form.moduloLed3500 || form.moduloLed4000 || form.moduloLed5000 || modulosLedExtra.some((item) => item.cct && item.modelo)) ? (
              <span className="text-[10px] text-muted-foreground ml-auto">Derivado automaticamente dos módulos LED</span>
            ) : (
              <span className="text-[10px] text-muted-foreground ml-auto">Marcadas por padrão — desmarque se não aplicável</span>
            )}
          </div>

          {form.semModuloLed || form.moduloLampada || form.moduloTunableWhite ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
              A seleção de temperatura de cor fica desabilitada para esta modalidade de iluminação.
            </div>
          ) : form.moduloRgbw ? (
            // Modo RGBW: mostrar apenas badge RGBW
            <div className="flex flex-wrap gap-3">
              <div
                className="temp-badge temp-badge-active"
                style={{ borderColor: "oklch(0.75 0.15 310)", color: "oklch(0.75 0.15 310)", backgroundColor: "oklch(0.75 0.15 310 / 0.15)" }}
                title="Modo RGBW ativo"
              >
                <span className="w-2 h-2 rounded-full mr-1.5 inline-block" style={{ backgroundColor: "oklch(0.75 0.15 310)" }} />
                RGBW
              </div>
            </div>
          ) : (form.moduloLed2700 || form.moduloLed3000 || form.moduloLed3500 || form.moduloLed4000 || form.moduloLed5000 || modulosLedExtra.some((item) => item.cct && item.modelo)) ? (
            // Modo derivado: CCTs determinados pelos módulos preenchidos
            <div className="flex flex-wrap gap-3">
              {TEMPERATURAS.map((temp) => {
                const fieldMap: Record<string, keyof FormData> = {
                  "2700": "moduloLed2700", "3000": "moduloLed3000",
                  "3500": "moduloLed3500",
                  "4000": "moduloLed4000", "5000": "moduloLed5000",
                };
                const active = !!(form[fieldMap[temp]]);
                const colors: Record<string, string> = {
                  "2700": "oklch(0.75 0.15 65)", "3000": "oklch(0.80 0.12 75)",
                  "3500": "oklch(0.82 0.10 85)",
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
              {modulosLedExtra.filter((item) => item.cct && item.modelo).map((item, index) => (
                <div
                  key={`${item.cct}-${item.modelo}-${index}`}
                  className="temp-badge temp-badge-active cursor-default select-none"
                  style={{ borderColor: "oklch(0.70 0.12 165)", color: "oklch(0.70 0.12 165)", backgroundColor: "oklch(0.70 0.12 165 / 0.15)" }}
                  title={`Módulo ${item.cct}K cadastrado`}
                >
                  <span className="w-2 h-2 rounded-full mr-1.5 inline-block bg-current" />
                  {item.cct}K
                </div>
              ))}
            </div>
          ) : (
            // Modo manual: seleção livre (produtos legados sem módulos CCT)
            <>
              <div className="flex flex-wrap gap-3">
                {TEMPERATURAS.map((temp) => {
                  const active = form.temperaturasCor.includes(temp);
                  const colors: Record<string, string> = {
                  "2700": "oklch(0.75 0.15 65)", "3000": "oklch(0.80 0.12 75)",
                  "3500": "oklch(0.82 0.10 85)",
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
            const drivers: Array<{
              label: string;
              custoField: keyof FormData;
              mkpPField: keyof FormData;
              mkpMField: keyof FormData;
            }> = [
              { label: "ON/OFF 220Vac",    custoField: "custoCorpoOnoff220v",    mkpPField: "mkpPadraoOnoff220v",    mkpMField: "mkpMinimoOnoff220v" },
              { label: "ON/OFF Bivolt",    custoField: "custoCorpoOnoffBivolt",  mkpPField: "mkpPadraoOnoffBivolt",  mkpMField: "mkpMinimoOnoffBivolt" },
              { label: "Dim 1-10V 220Vac", custoField: "custoCorpoDim110v",      mkpPField: "mkpPadraoDim110v",      mkpMField: "mkpMinimoDim110v" },
              { label: "Dim DALI",         custoField: "custoCorpoDimDali",       mkpPField: "mkpPadraoDimDali",       mkpMField: "mkpMinimoDimDali" },
              { label: "Dim Triac 110Vac", custoField: "custoCorpoDimTriac110v",  mkpPField: "mkpPadraoDimTriac110v",  mkpMField: "mkpMinimoDimTriac110v" },
              { label: "Dim Triac 220Vac", custoField: "custoCorpoDimTriac220v",  mkpPField: "mkpPadraoDimTriac220v",  mkpMField: "mkpMinimoDimTriac220v" },
            ];
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-[10px] text-muted-foreground uppercase tracking-wider pb-2 pr-4 font-medium">Tipo de Driver</th>
                      <th className="text-center text-[10px] text-muted-foreground uppercase tracking-wider pb-2 px-2 font-medium">Custo do Corpo (R$)</th>
                      <th className="text-center text-[10px] text-muted-foreground uppercase tracking-wider pb-2 px-2 font-medium">Markup Padrão</th>
                      <th className="text-center text-[10px] text-muted-foreground uppercase tracking-wider pb-2 px-2 font-medium">Markup Mínimo</th>
                      <th className="text-center text-[10px] text-muted-foreground uppercase tracking-wider pb-2 pl-2 font-medium">Preço de Lista (calc.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {drivers.map(({ label, custoField, mkpPField, mkpMField }) => {
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
                                value={(form[custoField] as string) ?? ''}
                                onChange={(e) => setField(custoField, e.target.value)}
                                placeholder="0,00"
                              />
                            </div>
                          </td>
                          <td className="py-2.5 px-2">
                            <Input
                              className="input-dark text-sm h-8 w-24 text-center"
                              type="number" step="0.1" min="1"
                              value={(form[mkpPField] as string) ?? ''}
                              onChange={(e) => setField(mkpPField, e.target.value)}
                              placeholder="ex: 4"
                            />
                          </td>
                          <td className="py-2.5 px-2">
                            {canEditCosts ? (
                              <Input
                                className="input-dark text-sm h-8 w-24 text-center"
                                type="number" step="0.1" min="1"
                                value={(form[mkpMField] as string) ?? ''}
                                onChange={(e) => setField(mkpMField, e.target.value)}
                                placeholder="ex: 3"
                              />
                            ) : (
                              <div className="w-24 h-8 flex items-center justify-center rounded-md bg-muted/30 border border-border/40 cursor-not-allowed" title="Apenas administradores podem alterar o markup mínimo">
                                <span className="text-sm font-semibold text-amber-400">{form[mkpMField] || '2'}</span>
                                <span className="ml-1 text-[9px] text-muted-foreground/60">🔒</span>
                              </div>
                            )}
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

        {/* Seção 7: Preço de Venda — REMOVIDA conforme solicitação */}
        {false && <section className="alfalux-card p-6">
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
        </section>}

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

// ─── Composição D1+D2 types ────────────────────────────────────────────────

interface ComposicaoD1D2Driver {
  tipo: string;
  modelo: string;
  qtd: number;
  custo: string;
}

interface D1D2DriversState {
  onoff220: { modelo: string; qtd: number; custo: string };
  onoffBivolt: { modelo: string; qtd: number; custo: string };
  dim110v: { modelo: string; qtd: number; custo: string };
  dimDali: { modelo: string; qtd: number; custo: string };
  dimTriac110v: { modelo: string; qtd: number; custo: string };
  dimTriac220v: { modelo: string; qtd: number; custo: string };
}

const emptyD1D2DriversState = (): D1D2DriversState => ({
  onoff220: { modelo: "", qtd: 1, custo: "" },
  onoffBivolt: { modelo: "", qtd: 1, custo: "" },
  dim110v: { modelo: "", qtd: 1, custo: "" },
  dimDali: { modelo: "", qtd: 1, custo: "" },
  dimTriac110v: { modelo: "", qtd: 1, custo: "" },
  dimTriac220v: { modelo: "", qtd: 1, custo: "" },
});

type D1D2ComponentType = "DRIVER_ONOFF_220" | "DRIVER_ONOFF_BIVOLT" | "DRIVER_DIM_110V" | "DRIVER_DIM_DALI" | "DRIVER_DIM_TRIAC_110V" | "DRIVER_DIM_TRIAC_220V";

function D1D2DriverField({ label, tipo, value, onChange }: {
  label: string;
  tipo: D1D2ComponentType;
  value: { modelo: string; qtd: number; custo: string };
  onChange: (v: { modelo: string; qtd: number; custo: string }) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="field-label text-amber-400/80">{label} (D1+D2)</Label>
      <div className="flex gap-2 items-start">
        <div className="flex-1">
          <ComponentSelect
            tipo={tipo}
            value={value.modelo}
            onChange={(v) => onChange({ ...value, modelo: v })}
            onSelectComponent={(comp) => {
              if (comp.custoDriver) {
                onChange({ ...value, modelo: comp.modelo, custo: comp.custoDriver });
              }
            }}
            placeholder={`Driver ${label}...`}
          />
        </div>
        <div className="w-16">
          <Input
            className="input-dark text-sm h-9 text-center"
            type="number" min={1}
            value={value.qtd}
            onChange={(e) => onChange({ ...value, qtd: parseInt(e.target.value) || 1 })}
            title="Quantidade"
          />
        </div>
        <div className="relative w-28">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">R$</span>
          <Input
            className="input-dark pl-7 text-sm h-9"
            type="number" step="0.01" min={0}
            value={value.custo}
            onChange={(e) => onChange({ ...value, custo: e.target.value })}
            placeholder="0,00"
            title="Custo unitário (preenchido automaticamente)"
          />
        </div>
      </div>
    </div>
  );
}
