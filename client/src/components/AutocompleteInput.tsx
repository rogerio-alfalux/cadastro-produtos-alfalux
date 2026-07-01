import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type SuggestionField =
  | "familia"
  | "produto"
  | "moduloLed"
  | "otica"
  | "holder"
  | "dissipador"
  | "driverOnoff220"
  | "driverOnoffBivolt"
  | "driverDim110v"
  | "driverDimDali";

interface AutocompleteInputProps {
  field: SuggestionField;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  hasError?: boolean;
}

export function AutocompleteInput({
  field,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  className,
  hasError,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  // ─── Debounced query: only update after 300ms of inactivity ───────────────
  const [debouncedQuery, setDebouncedQuery] = useState(value.trim());
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseDownOnListRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce: update the query used for API calls 300ms after the user stops typing
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 300);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [value]);

  const { data: suggestions = [] } = trpc._products_tail.suggestions.useQuery(
    { field, query: debouncedQuery },
    {
      enabled: open && debouncedQuery.length >= 1,
      staleTime: 30_000,
      placeholderData: (prev: string[] | undefined) => prev,
    }
  );

  // Reset highlight when suggestions list changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions.length]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const upper = e.target.value.toUpperCase();
    onChange(upper);
    setOpen(true);
    setHighlightedIndex(-1);
  };

  const selectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setOpen(false);
    setHighlightedIndex(-1);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" || e.key === "Delete") return;

    if (e.key === "Escape") {
      setOpen(false);
      return;
    }

    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        selectSuggestion(suggestions[highlightedIndex]);
      } else {
        setOpen(false);
      }
    } else if (e.key === "Tab") {
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        e.preventDefault();
        selectSuggestion(suggestions[highlightedIndex]);
      } else {
        setOpen(false);
      }
    }
  };

  const handleFocus = () => {
    if (debouncedQuery.length >= 1) setOpen(true);
  };

  const handleBlur = () => {
    if (mouseDownOnListRef.current) return;
    setOpen(false);
    onBlur?.();
  };

  const showDropdown = open && suggestions.length > 0 && !disabled;

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "input-dark",
          hasError && "border-destructive ring-1 ring-destructive",
          className
        )}
      />

      {showDropdown && (
        <ul
          role="listbox"
          className="absolute z-50 left-0 right-0 top-full mt-1 max-h-60 overflow-auto rounded-md border border-border bg-card shadow-lg"
          onMouseDown={() => { mouseDownOnListRef.current = true; }}
          onMouseUp={() => { mouseDownOnListRef.current = false; }}
        >
          {suggestions.map((suggestion: string, index: number) => (
            <li
              key={suggestion}
              role="option"
              aria-selected={index === highlightedIndex}
              onMouseDown={(e) => { e.preventDefault(); }}
              onClick={() => {
                mouseDownOnListRef.current = false;
                selectSuggestion(suggestion);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                "px-3 py-2 text-sm cursor-pointer select-none transition-colors",
                index === highlightedIndex
                  ? "bg-primary/20 text-primary"
                  : "text-foreground hover:bg-muted/50"
              )}
            >
              <SuggestionHighlight text={suggestion} query={debouncedQuery} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SuggestionHighlight({ text, query }: { text: string; query: string }) {
  if (!query) return <span>{text}</span>;
  const idx = text.toUpperCase().indexOf(query.toUpperCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <span className="font-semibold text-primary">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </span>
  );
}
