"use client";

import { useCallback, useRef, useState } from "react";

export interface MentionState {
  active: boolean;
  start: number;
  query: string;
}

const INITIAL: MentionState = { active: false, start: -1, query: "" };

/**
 * Detects an active "@mention" token at the input cursor and provides handlers
 * to wire into any controlled text input. Supports multiple inputs (e.g. a
 * mobile and a desktop composer) via per-key `register`.
 */
export function useMention(value: string, setValue: (v: string) => void) {
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const [mention, setMention] = useState<MentionState>(INITIAL);

  const detect = useCallback((input: HTMLInputElement | null) => {
    if (!input) {
      setMention(INITIAL);
      return;
    }
    const text = input.value;
    const cursor = input.selectionStart ?? text.length;
    const atIdx = text.slice(0, cursor).lastIndexOf("@");
    if (atIdx < 0) {
      setMention(INITIAL);
      return;
    }
    // "@" must be at the start or preceded by whitespace (not "name@x").
    const charBefore = atIdx === 0 ? " " : text[atIdx - 1];
    if (!/\s/.test(charBefore)) {
      setMention(INITIAL);
      return;
    }
    const query = text.slice(atIdx + 1, cursor);
    // A mention query cannot contain whitespace; once the user types a space
    // the mention is considered finished.
    if (/\s/.test(query)) {
      setMention(INITIAL);
      return;
    }
    setMention({ active: true, start: atIdx, query });
  }, []);

  const register = useCallback(
    (key: string) => ({
      ref: (el: HTMLInputElement | null) => {
        refs.current[key] = el;
      },
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
        detect(e.target);
      },
      onKeyUp: (e: React.KeyboardEvent<HTMLInputElement>) => detect(e.currentTarget),
      onSelect: (e: React.SyntheticEvent<HTMLInputElement>) => detect(e.currentTarget),
      onClick: (e: React.MouseEvent<HTMLInputElement>) => detect(e.currentTarget),
      onFocus: (e: React.FocusEvent<HTMLInputElement>) => detect(e.currentTarget),
    }),
    [detect, setValue]
  );

  const applyMention = useCallback(
    (name: string) => {
      const insert = `@${name} `;
      const inputs = Object.values(refs.current).filter(
        (el): el is HTMLInputElement => Boolean(el)
      );
      const input =
        inputs.find((el) => el === document.activeElement) ?? inputs[0] ?? null;

      if (!input) {
        setValue(insert);
        setMention(INITIAL);
        return;
      }

      const cursor = input.selectionStart ?? value.length;
      const at = mention.active && mention.start >= 0 ? mention.start : cursor;
      const next = value.slice(0, at) + insert + value.slice(cursor);
      setValue(next);
      setMention(INITIAL);

      requestAnimationFrame(() => {
        const pos = at + insert.length;
        input.focus();
        input.setSelectionRange(pos, pos);
      });
    },
    [mention, setValue, value]
  );

  const close = useCallback(() => setMention(INITIAL), []);

  return { mention, register, applyMention, close };
}
