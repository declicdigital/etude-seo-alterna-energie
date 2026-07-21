import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Double-click to edit inline. Enter/Blur commits, Escape cancels.
 * Renders `children` (or `value`) as static text otherwise.
 */
export function EditableText({
  value,
  onCommit,
  className,
  inputClassName,
  placeholder,
  as: As = "span",
  title,
  onClickCapture,
}: {
  value: string;
  onCommit: (next: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  as?: "span" | "div" | "h1" | "h2" | "h3";
  title?: string;
  onClickCapture?: (e: React.MouseEvent) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onBlur={() => {
          setEditing(false);
          if (draft !== value) onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.currentTarget.blur(); }
          else if (e.key === "Escape") { setDraft(value); setEditing(false); }
          e.stopPropagation();
        }}
        placeholder={placeholder}
        className={cn(
          "bg-background border border-primary/40 rounded px-1.5 py-0.5 text-inherit font-inherit outline-none focus:ring-2 focus:ring-ring w-full min-w-0",
          inputClassName,
        )}
      />
    );
  }
  return (
    <As
      className={cn("cursor-text", className)}
      title={title ?? "Double-cliquez pour renommer"}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
      onClick={onClickCapture}
    >
      {value || <span className="text-muted-foreground italic">{placeholder ?? "Sans nom"}</span>}
    </As>
  );
}