"use client";

import { useState, type RefObject } from "react";
import { Smile } from "lucide-react";

import { Button } from "@/components/ui/button";

const EMOJI = [
  "🕌", "🤲", "🙏", "☪️", "📿", "🌙", "⭐", "✨",
  "✅", "☑️", "👍", "🙌", "🤝", "❤️", "💚", "😊",
  "😇", "🎉", "🎊", "🎁", "💰", "💵", "🧧", "📢",
  "📌", "📅", "📖", "🫶", "🌸", "😀", "🥳", "💐",
];

/**
 * Inserts an emoji into the message at the textarea's current cursor
 * position. `value`/`onChange` are the controlled message state (needed so
 * the live preview bubble and later wizard steps see the update); cursor
 * position is restored after React re-renders the textarea.
 */
export function EmojiPicker({
  value,
  onChange,
  textareaRef,
}: {
  value: string;
  onChange: (next: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const [open, setOpen] = useState(false);

  function insert(emoji: string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(end);
    onChange(next);
    setOpen(false);

    requestAnimationFrame(() => {
      if (!el) return;
      const pos = start + emoji.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative inline-block">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Sisip emoji"
        onClick={() => setOpen((v) => !v)}
      >
        <Smile className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 grid w-64 grid-cols-8 gap-1 rounded-lg border bg-popover p-2 shadow-md">
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              className="rounded p-1 text-lg hover:bg-accent"
              onClick={() => insert(e)}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
