"use client";

import { Avatar } from "@/shared/ui";

export interface MentionCandidate {
  id: string;
  name: string;
  personId: string;
  isBot?: boolean;
}

interface MentionSuggestionsProps {
  candidates: MentionCandidate[];
  highlightIndex: number;
  onSelect: (candidate: MentionCandidate) => void;
  onHover: (index: number) => void;
}

export function MentionSuggestions({
  candidates,
  highlightIndex,
  onSelect,
  onHover,
}: MentionSuggestionsProps) {
  return (
    <div
      className="absolute bottom-full left-0 z-30 mb-2 max-h-60 w-64 overflow-y-auto rounded-2xl border border-line bg-surface shadow-lg scrollbar-hide"
      role="listbox"
    >
      <div className="px-3 pb-1 pt-2 text-[11px] uppercase tracking-wide text-ink-3">
        Mention
      </div>
      {candidates.map((c, i) => (
        <button
          key={c.id}
          type="button"
          role="option"
          aria-selected={i === highlightIndex}
          onMouseEnter={() => onHover(i)}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(c);
          }}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors"
          style={{
            background: i === highlightIndex ? "var(--color-surface-2)" : "transparent",
          }}
        >
          <Avatar who={c.personId} size={28} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink">{c.name}</div>
            {c.isBot && <div className="text-[11px] text-ink-3">Assistant</div>}
          </div>
        </button>
      ))}
    </div>
  );
}
