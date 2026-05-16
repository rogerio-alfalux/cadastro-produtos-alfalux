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
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Track whether a suggestion click is in progress to avoid premature close
  const mouseDownOnListRef = useRef(false);

  // Use the external `value` directly as the query for suggestions
  const queryForSuggestions = value.trim();

  const { data: suggestions = [] } = trpc.products.suggestions.useQuery(
    { field, query: queryForSuggestions },
    {
      enabled: open && queryForSuggestions.length >= 1,
      staleTime: 15_000,
      // Keep previous data while new query is loading to avoid flicker
      placeholderData: (prev) => prev,
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
    // Convert to uppercase and pass directly to parent — no internal state copy
    const upper = e.target.value.toUpperCase();
    onChange(upper);
    setOpen(true);
    setHighlightedIndex(-1);
  };

  const selectSuggestion = (suggestion: string) => {
    onChange(suggestion);
    setOpen(false);
    setHighlightedIndex(-1);
    // Return focus to input so user can keep editing
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Never intercept Delete/Backspace — let the browser handle natively
    if (e.key === "Backspace" || e.key === "Delete") {
      return;
    }

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
    if (queryForSuggestions.length >= 1) setOpen(true);
  };

  const handleBlur = () => {
    // If the blur was caused by clicking on the suggestion list, don't close yet
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
          onMouseDown={() => {
            // Signal that a click on the list is happening so blur doesn't close it
            mouseDownOnListRef.current = true;
          }}
          onMouseUp={() => {
            mouseDownOnListRef.current = false;
          }}
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              role="option"
              aria-selected={index === highlightedIndex}
              onMouseDown={(e) => {
                // Prevent the input from losing focus before we apply the selection
                e.preventDefault();
              }}
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
              <SuggestionHighlight text={suggestion} query={queryForSuggestions} />
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
