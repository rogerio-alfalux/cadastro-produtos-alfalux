import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ChevronDown, X } from "lucide-react";

type ComponentType =
  | "DRIVER_ONOFF_220"
  | "DRIVER_ONOFF_BIVOLT"
  | "DRIVER_DIM_110V"
  | "DRIVER_DIM_DALI"
  | "DRIVER_DIM_TRIAC_110V"
  | "DRIVER_DIM_TRIAC_220V"
  | "OTICA"
  | "HOLDER"
  | "DISSIPADOR"
  | "MODULO_LED";

interface ComponentSelectProps {
  tipo: ComponentType;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  hasError?: boolean;
}

export function ComponentSelect({
  tipo,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  className,
  hasError,
}: ComponentSelectProps) {
  // `inputValue` é o que aparece no input enquanto o usuário digita.
  // É inicializado com `value` e sincronizado quando `value` muda externamente.
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suppressBlurRef = useRef(false);

  // Sincroniza inputValue quando value muda externamente (ex: ao carregar produto)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const { data: allComponents = [] } = trpc.components.list.useQuery(
    { tipo },
    { staleTime: 60_000 }
  );

  // Filtra localmente pelo que o usuário digitou
  const query = inputValue.trim().toUpperCase();
  const filtered = query
    ? allComponents.filter((c) =>
        c.modelo.toUpperCase().includes(query) ||
        (c.codigo && c.codigo.toUpperCase().includes(query))
      )
    : allComponents;

  const handleSelect = useCallback((modelo: string) => {
    suppressBlurRef.current = true;
    onChange(modelo);
    setInputValue(modelo);
    setOpen(false);
    // Devolve o foco ao input após seleção
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      suppressBlurRef.current = false;
    });
  }, [onChange]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    suppressBlurRef.current = true;
    onChange("");
    setInputValue("");
    setOpen(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      suppressBlurRef.current = false;
    });
  }, [onChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const upper = e.target.value.toUpperCase();
    setInputValue(upper);
    onChange(upper);
    setOpen(true);
  };

  const handleFocus = () => {
    if (!disabled) setOpen(true);
  };

  const handleBlur = () => {
    if (suppressBlurRef.current) return;
    // Pequeno delay para permitir que o clique no item da lista seja processado
    setTimeout(() => {
      if (!suppressBlurRef.current) {
        setOpen(false);
        onBlur?.();
      }
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "Enter" && filtered.length > 0) {
      e.preventDefault();
      handleSelect(filtered[0].modelo);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input principal — sem div wrapper interceptando cliques */}
      <div
        className={cn(
          "flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
          "focus-within:ring-1 focus-within:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
          hasError && "border-destructive ring-1 ring-destructive",
          className
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={open ? "Buscar componente..." : (placeholder || "Selecionar...")}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground text-sm min-w-0 cursor-text"
        />
        <div className="flex items-center gap-1 ml-1 shrink-0">
          {value && !disabled && (
            <button
              type="button"
              onMouseDown={handleClear}
              className="text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </div>
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <ul
          role="listbox"
          // onMouseDown com preventDefault impede que o clique no item tire o foco do input
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-50 left-0 right-0 top-full mt-1 max-h-64 overflow-auto rounded-md border border-border bg-card shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground italic">
              {allComponents.length === 0
                ? "Nenhum componente cadastrado para este tipo"
                : "Nenhum resultado encontrado"}
            </li>
          ) : (
            filtered.map((c) => (
              <li
                key={c.id}
                role="option"
                onClick={() => handleSelect(c.modelo)}
                className={cn(
                  "px-3 py-2 text-sm cursor-pointer select-none transition-colors",
                  c.modelo === value
                    ? "bg-primary/20 text-primary font-medium"
                    : "text-foreground hover:bg-muted/50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{c.modelo}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.codigo && (
                      <span className="text-xs text-muted-foreground font-mono">{c.codigo}</span>
                    )}
                    {c.custo && (
                      <span className="text-xs text-emerald-400">
                        R$ {Number(c.custo).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
