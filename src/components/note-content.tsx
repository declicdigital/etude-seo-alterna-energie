import { Fragment, type ReactNode } from "react";
import { parseNote, type Block, type Inline } from "@/lib/note-format";
import { cn } from "@/lib/utils";

const LINK =
  "break-words text-amber-800 underline decoration-amber-800/30 underline-offset-2 hover:decoration-amber-800 dark:text-amber-300 dark:decoration-amber-300/40";

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.type) {
      case "text":
        return <Fragment key={i}>{n.text}</Fragment>;
      case "link":
        return (
          <a
            key={i}
            href={n.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(LINK, n.text === n.href && "break-all")}
          >
            {n.text}
          </a>
        );
      case "strong":
        return (
          <strong key={i} className="font-semibold text-foreground">
            {renderInline(n.children)}
          </strong>
        );
      case "em":
        return <em key={i}>{renderInline(n.children)}</em>;
      case "code":
        return (
          <code
            key={i}
            className="rounded bg-amber-900/[0.07] px-1 py-0.5 font-mono text-[0.85em] dark:bg-amber-100/10"
          >
            {n.text}
          </code>
        );
    }
  });
}

function renderLines(lines: Inline[][]): ReactNode {
  return lines.map((l, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderInline(l)}
    </Fragment>
  ));
}

function renderBlocks(blocks: Block[], depth = 0): ReactNode {
  return blocks.map((b, i) => {
    switch (b.type) {
      case "heading": {
        const Tag = (["h3", "h4", "h5"] as const)[b.level - 1];
        return (
          <Tag
            key={i}
            className={cn(
              "font-semibold leading-snug text-foreground [&:not(:first-child)]:mt-6",
              b.level === 1 ? "text-[1.3em]" : b.level === 2 ? "text-[1.15em]" : "text-[1.05em]",
            )}
          >
            {renderInline(b.content)}
          </Tag>
        );
      }
      case "section":
        return (
          <h4
            key={i}
            className="flex items-baseline gap-2.5 text-[1.08em] font-semibold leading-snug text-foreground [&:not(:first-child)]:mt-7"
          >
            <span className="inline-flex size-6 shrink-0 translate-y-[-1px] items-center justify-center self-center rounded-full bg-amber-800/10 font-sans text-[13px] font-semibold tabular-nums text-amber-900 dark:bg-amber-300/15 dark:text-amber-200">
              {b.number}
            </span>
            <span>{renderInline(b.content)}</span>
          </h4>
        );
      case "para":
        return (
          <p key={i} className="[&:not(:first-child)]:mt-3">
            {renderLines(b.lines)}
          </p>
        );
      case "quote":
        return (
          <blockquote
            key={i}
            className="border-l-2 border-amber-800/25 pl-4 italic text-foreground/75 dark:border-amber-300/30 [&:not(:first-child)]:mt-3"
          >
            {renderLines(b.lines)}
          </blockquote>
        );
      case "hr":
        return (
          <hr
            key={i}
            className="my-5 border-t border-dashed border-amber-900/15 dark:border-amber-100/15"
          />
        );
      case "list": {
        const Tag = b.ordered ? "ol" : "ul";
        return (
          <Tag
            key={i}
            className={cn(
              "space-y-1 pl-7",
              depth === 0 ? "[&:not(:first-child)]:mt-2.5" : "mt-1",
              b.ordered
                ? "list-decimal marker:font-sans marker:text-[0.9em] marker:font-semibold marker:text-amber-800/80 dark:marker:text-amber-300/80"
                : depth % 2 === 0
                  ? "list-disc marker:text-amber-800/60 dark:marker:text-amber-300/60"
                  : "list-[circle] marker:text-amber-800/60 dark:marker:text-amber-300/60",
            )}
          >
            {b.items.map((item, k) => (
              <li
                key={k}
                value={b.ordered && item.number !== null ? item.number : undefined}
                className="pl-1"
              >
                {renderLines(item.lines)}
                {item.children.length > 0 && renderBlocks(item.children, depth + 1)}
              </li>
            ))}
          </Tag>
        );
      }
    }
  });
}

/** A note written in light Markdown, shown formatted (lists, links, bold…). */
export function NoteContent({ text, className }: { text: string; className?: string }) {
  return <div className={cn("break-words", className)}>{renderBlocks(parseNote(text))}</div>;
}
