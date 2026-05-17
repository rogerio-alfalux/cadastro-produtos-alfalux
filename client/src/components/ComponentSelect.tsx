import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ChevronDown, X } from "lucide-react";

type ComponentType =
  | "DRIVER_ONOFF_220"
  | "DRIVER_ONOFF_BIVOLT"
  | "DRIVER_DIM_110V"
  | "DRIVER_DIM_DALI"
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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const { data: allComponents = [] } = trpc.components.list.useQuery(
    { tipo },
    { staleTime: 60_000 }
  );

  // Filter locally by search
  const filtered = debouncedSearch.trim()
    ? allComponents.filter((c) =>
        c.modelo.toUpperCase().includes(debouncedSearch.toUpperCase()) ||
        (c.codigo && c.codigo.toUpperCase().includes(debouncedSearch.toUpperCase()))
      )
    : allComponents;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        onBlur?.();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onBlur]);

  const handleSelect = (modelo: string) => {
    onChange(modelo);
    setSearch("");
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const upper = e.target.value.toUpperCase();
    setSearch(upper);
    // If user types something not in the list, allow free text
    onChange(upper);
    setOpen(true);
  };

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setSearch("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const displayValue = open ? search : value;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger / Input */}
      <div
        className={cn(
          "flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors cursor-text",
          "focus-within:ring-1 focus-within:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
          hasError && "border-destructive ring-1 ring-destructive",
          className
        )}
        onClick={handleOpen}
      >
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder={open ? "Buscar componente..." : (placeholder || "Selecionar...")}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground text-sm min-w-0"
        />
        <div className="flex items-center gap-1 ml-1 shrink-0">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <ul
          role="listbox"
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
                onMouseDown={(e) => e.preventDefault()}
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
