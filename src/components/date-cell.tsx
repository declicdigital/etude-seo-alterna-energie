import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Parse a value that might already be a Date, an ISO string, or a
 *  dd/mm/yyyy string. Returns null when unparseable. */
export function parseDateValue(input: string | number | null | undefined): Date | null {
  if (input == null) return null;
  const t = String(input).trim();
  if (!t) return null;
  let m = t.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d.getTime()) ? null : d;
  }
  m = t.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) {
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function toIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DateCell({
  value,
  onChange,
  className,
  compact,
  placeholder = "-",
}: {
  value: string | number | null;
  onChange: (iso: string | null) => void;
  className?: string;
  compact?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseDateValue(value);
  const raw = value == null ? "" : String(value).trim();
  const label = parsed
    ? format(parsed, compact ? "dd MMM yyyy" : "d MMMM yyyy", { locale: fr })
    : raw || placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-muted/50 text-xs px-2 py-1 min-w-0 max-w-full transition-colors",
            !parsed && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-3 shrink-0" />
          <span className="truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 pointer-events-auto"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <Calendar
          mode="single"
          selected={parsed ?? undefined}
          defaultMonth={parsed ?? undefined}
          onSelect={(d) => {
            if (d) {
              onChange(toIso(d));
              setOpen(false);
            }
          }}
          initialFocus
          locale={fr}
          className={cn("p-3 pointer-events-auto")}
        />
        {parsed && (
          <div className="border-t border-border p-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted"
            >
              <X className="size-3" /> Effacer
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}