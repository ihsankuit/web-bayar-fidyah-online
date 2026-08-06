"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, X } from "lucide-react";

import { cn, formatRelativeTime } from "@/lib/utils";
import type { SocialProofItem } from "@/lib/social-proof";

const DISMISS_KEY = "fidyah-social-proof-dismissed";
const INITIAL_DELAY_MS = 4_000;
const VISIBLE_MS = 6_000;
const GAP_MS = 10_000;
const EXIT_TRANSITION_MS = 400;

export function SocialProofNotification({ items }: { items: SocialProofItem[] }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (closed || items.length === 0) return;
    // A user who already closed this earlier in the session shouldn't see
    // it flash back in on the next page view.
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    let timer: ReturnType<typeof setTimeout>;

    function showNext() {
      setVisible(true);
      timer = setTimeout(() => {
        setVisible(false);
        timer = setTimeout(() => {
          setIndex((i) => (i + 1) % items.length);
        }, EXIT_TRANSITION_MS);
      }, VISIBLE_MS);
    }

    timer = setTimeout(showNext, index === 0 ? INITIAL_DELAY_MS : GAP_MS);
    return () => clearTimeout(timer);
  }, [index, closed, items.length]);

  if (items.length === 0) return null;

  const item = items[index];

  function handleDismiss() {
    setVisible(false);
    setClosed(true);
    sessionStorage.setItem(DISMISS_KEY, "1");
  }

  return (
    <div
      role="status"
      className={cn(
        "fixed bottom-4 left-4 z-40 flex max-w-[280px] items-start gap-3 rounded-xl border bg-card p-3 pr-8 shadow-lg transition-all duration-300 sm:max-w-xs",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0"
      )}
    >
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ShieldCheck className="h-4 w-4" />
      </div>
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium">
          {item.firstName}
          {item.negeri ? ` dari ${item.negeri}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          Membayar fidyah &middot; {formatRelativeTime(item.paidAt)}
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
        aria-label="Tutup notifikasi"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
