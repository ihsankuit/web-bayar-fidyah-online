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
 * Inserts an emoji into `textareaRef`'s current cursor position. The
 * textarea stays an uncontrolled field (native FormData submission), so we
 * mutate the DOM value directly rather than routing through React state.
 */
export function EmojiPicker({
  textareaRef,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const [open, setOpen] = useState(false);

  function insert(emoji: string) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + emoji + el.value.slice(end);
    const pos = start + emoji.length;
    el.focus();
    el.setSelectionRange(pos, pos);
    setOpen(false);
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
        <div className="absolute z-10 mt-1 grid w-64 grid-cols-8 gap-1 rounded-lg border bg-popover p-2 shadow-md">
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
