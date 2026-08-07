"use client";

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const EMOJI = [
  "😊", "🙏", "❤️", "👍", "✅", "🎉", "🌙", "⭐",
  "📿", "🕌", "💚", "📢", "📅", "⏰", "❗", "❓",
  "👏", "🤲", "💰", "📦", "🚚", "🤝", "🌟", "💫",
  "🍚", "🧕", "👨‍👩‍👧‍👦", "🏠", "😔", "🥹", "👋", "💌",
];

export function EmojiPickerButton({
  onSelect,
}: {
  onSelect: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
      >
        <Smile /> Emoji
      </Button>
      {open && (
        <div
          className={cn(
            "absolute bottom-full left-0 z-20 mb-2 grid w-64 grid-cols-8 gap-1 rounded-lg border border-border bg-popover p-2 shadow-md"
          )}
        >
          {EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onSelect(emoji);
                setOpen(false);
              }}
              className="rounded p-1 text-lg hover:bg-accent"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
