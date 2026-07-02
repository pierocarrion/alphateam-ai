"use client";

import { Fragment, type ReactNode } from "react";

/**
 * Minimal, dependency-free Markdown renderer tuned for chat replies.
 *
 * Supports a safe subset (paragraphs, bullet/numbered lists, **bold**,
 * _italic_, `inline code`, headings up to H3, and blockquotes). No raw HTML is
 * ever rendered — every node is constructed as a React element so this is safe
 * by construction against model output.
 *
 * Inline formatting is parsed character-by-character (no regex split that would
 * mangle nested markers). Block-level parsing is line oriented.
 */
export function Markdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-ink-2">
      {blocks.map((b, i) => renderBlock(b, i))}
    </div>
  );
}

/* ----------------------------- Block parsing ----------------------------- */

type Block =
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "quote"; text: string }
  | { type: "hr" };

function parseBlocks(input: string): Block[] {
  const out: Block[] = [];
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      out.push({ type: "hr" });
      i++;
      continue;
    }

    // Headings
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      out.push({ type: "h", level: h[1].length as 1 | 2 | 3, text: h[2].trim() });
      i++;
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push({ type: "quote", text: buf.join(" ") });
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, "").trim());
        i++;
      }
      out.push({ type: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, "").trim());
        i++;
      }
      out.push({ type: "ol", items });
      continue;
    }

    // Paragraph: gather consecutive non-empty, non-special lines
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^\s*([-*_])\1{2,}\s*$/.test(lines[i]) &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      buf.push(lines[i].trim());
      i++;
    }
    out.push({ type: "p", lines: buf });
  }

  return out;
}

/* ----------------------------- Rendering ----------------------------- */

function renderBlock(b: Block, key: number): ReactNode {
  switch (b.type) {
    case "h": {
      const sizes = {
        1: "font-display text-base font-bold text-ink",
        2: "font-display text-sm font-bold text-ink",
        3: "text-[13px] font-bold uppercase tracking-[0.1em] text-ink-3",
      } as const;
      return (
        <p key={key} className={sizes[b.level]}>
          {renderInline(b.text)}
        </p>
      );
    }
    case "p":
      return (
        <p key={key} className="text-wrap-pretty">
          {b.lines.map((l, idx) => (
            <Fragment key={idx}>
              {idx > 0 && <br />}
              {renderInline(l)}
            </Fragment>
          ))}
        </p>
      );
    case "ul":
      return (
        <ul key={key} className="flex flex-col gap-1 pl-1">
          {b.items.map((it, idx) => (
            <li key={idx} className="flex gap-2">
              <span aria-hidden className="mt-[0.55em] h-1 w-1 flex-none rounded-full bg-accent" />
              <span>{renderInline(it)}</span>
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="flex flex-col gap-1 pl-1">
          {b.items.map((it, idx) => (
            <li key={idx} className="flex gap-2">
              <span className="mt-0.5 flex-none font-display text-[11px] font-bold text-accent">
                {idx + 1}.
              </span>
              <span>{renderInline(it)}</span>
            </li>
          ))}
        </ol>
      );
    case "quote":
      return (
        <blockquote
          key={key}
          className="border-l-2 border-accent/60 bg-accent-soft/40 py-1.5 pl-3 text-ink-2 italic"
        >
          {renderInline(b.text)}
        </blockquote>
      );
    case "hr":
      return <hr key={key} className="border-line" />;
  }
}

/* ----------------------------- Inline parsing ----------------------------- */

/**
 * Inline parser. Walks the string and emits React nodes, supporting:
 *   **bold**   _italic_   `code`   ~~strike~~
 * plus graceful pass-through for unknown markers.
 */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let buf = "";
  let key = 0;

  const flush = () => {
    if (buf) {
      nodes.push(<Fragment key={key++}>{buf}</Fragment>);
      buf = "";
    }
  };

  const markers: Array<{ open: string; close: string; cls: string }> = [
    { open: "**", close: "**", cls: "font-semibold text-ink" },
    { open: "~~", close: "~~", cls: "line-through opacity-80" },
    { open: "`", close: "`", cls: "rounded bg-surface-2 px-1 py-0.5 font-mono text-[12px] text-accent" },
    { open: "_", close: "_", cls: "italic" },
  ];

  while (i < text.length) {
    const matched = markers.find((m) => text.startsWith(m.open, i));
    if (matched) {
      const end = text.indexOf(matched.close, i + matched.open.length);
      if (end !== -1) {
        flush();
        const inner = text.slice(i + matched.open.length, end);
        nodes.push(
          <span key={key++} className={matched.cls}>
            {inner}
          </span>
        );
        i = end + matched.close.length;
        continue;
      }
    }
    buf += text[i];
    i++;
  }
  flush();
  return nodes;
}
