import { useCallback, useEffect, useRef, useState } from "react";
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
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressBlurRef = useRef(false);

  // Fetch suggestions — only when query has content
  const { data: suggestions = [] } = trpc.products.suggestions.useQuery(
    { field, query },
    {
      enabled: !!query && query.trim().length >= 1 && open,
      staleTime: 10_000,
    }
  );

  // Close when clicking outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [suggestions]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const upper = raw.toUpperCase();
      setQuery(upper);
      onChange(upper);
      setOpen(true);
      setHighlightedIndex(-1);
    },
    [onChange]
  );

  const selectSuggestion = useCallback(
    (suggestion: string) => {
      // Prevent the blur from closing the dropdown before we apply the selection
      suppressBlurRef.current = true;
      onChange(suggestion);
      setQuery(suggestion);
      setOpen(false);
      setHighlightedIndex(-1);
      // Re-focus the input after selection so user can keep typing
      setTimeout(() => {
        inputRef.current?.focus();
        suppressBlurRef.current = false;
      }, 0);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // CRITICAL: Never intercept Delete or Backspace — let the browser handle them natively
      if (e.key === "Backspace" || e.key === "Delete") {
        // Just ensure dropdown stays open while editing
        if (!open && query.length > 0) setOpen(true);
        return; // Do NOT call e.preventDefault() or e.stopPropagation()
      }

      if (!open || suggestions.length === 0) {
        if (e.key === "Escape") setOpen(false);
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
            selectSuggestion(suggestions[highlightedIndex]);
          } else {
            setOpen(false);
          }
          break;
        case "Escape":
          e.preventDefault();
          setOpen(false);
          setHighlightedIndex(-1);
          break;
        case "Tab":
          // Accept highlighted suggestion on Tab
          if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
            e.preventDefault();
            selectSuggestion(suggestions[highlightedIndex]);
          } else {
            setOpen(false);
          }
          break;
      }
    },
    [open, suggestions, highlightedIndex, query, selectSuggestion]
  );

  const handleFocus = useCallback(() => {
    if (query.trim().length >= 1) setOpen(true);
  }, [query]);

  const handleBlur = useCallback(() => {
    // If blur was triggered by clicking a suggestion, suppress it
    if (suppressBlurRef.current) return;
    // Small delay so mousedown on suggestion fires first
    setTimeout(() => {
      if (!suppressBlurRef.current) {
        setOpen(false);
        onBlur?.();
      }
    }, 150);
  }, [onBlur]);

  const showDropdown = open && suggestions.length > 0 && !disabled;

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className={cn(
          // Base input-dark styles (same as the shadcn Input component)
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "input-dark",
          hasError && "border-destructive ring-1 ring-destructive",
          className
        )}
      />

      {/* Suggestions dropdown */}
      {showDropdown && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 left-0 right-0 top-full mt-1 max-h-60 overflow-auto rounded-md border border-border bg-card shadow-lg"
          // Prevent mousedown from triggering blur on the input
          onMouseDown={(e) => e.preventDefault()}
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              role="option"
              aria-selected={index === highlightedIndex}
              onMouseDown={(e) => {
                e.preventDefault();
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
              {/* Highlight the matching part */}
              <SuggestionHighlight text={suggestion} query={query} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Highlights the matching substring in the suggestion
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
