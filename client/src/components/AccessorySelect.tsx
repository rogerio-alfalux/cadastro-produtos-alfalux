import { useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface AccessorySelectProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function AccessorySelect({ value, onChange, placeholder, disabled }: AccessorySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const queryInput = useMemo(() => ({ limit: 500, offset: 0 }), []);
  const { data } = trpc.accessories.list.useQuery(queryInput, { staleTime: 60_000 });
  const items = (data?.items ?? []).filter((item) => item.ativo !== false);
  const selected = items.find((item) => item.id === value);
  const normalizedSearch = search.trim().toUpperCase();
  const filtered = normalizedSearch
    ? items.filter((item) =>
        [item.produto, item.sku, item.codigo, item.familia]
          .some((field) => String(field ?? "").toUpperCase().includes(normalizedSearch)))
    : items;

  return (
    <div className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>
          {selected ? `${selected.produto}${selected.codigo ? ` · ${selected.codigo}` : ""}` : (placeholder || "Selecionar acessório...")}
        </span>
        <span className="ml-2 flex shrink-0 items-center gap-1">
          {selected && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Limpar lâmpada"
              onClick={(event) => {
                event.stopPropagation();
                onChange(null);
                setSearch("");
              }}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && !disabled && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 overflow-hidden rounded-md border border-border bg-card shadow-xl">
          <div className="border-b border-border p-2">
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por produto, SKU, código ou família..."
              className="h-8 w-full rounded border border-input bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <ul className="max-h-64 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm italic text-muted-foreground">Nenhum acessório encontrado</li>
            ) : filtered.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(item.id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left transition-colors hover:bg-muted/60",
                    item.id === value && "bg-primary/10",
                  )}
                >
                  <span className="block truncate text-sm font-medium text-foreground">{item.produto || "Acessório sem descrição"}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {[item.codigo, item.sku, item.familia].filter(Boolean).join(" · ") || "Sem código informado"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
