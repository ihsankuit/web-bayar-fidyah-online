"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DEFAULT_MESSAGE =
  "Assalamualaikum, saya ada pertanyaan tentang pembayaran fidyah.";
const DEFAULT_GREETING = "Ada pertanyaan? Kami di sini 👋";
const DISMISS_KEY = "wa-bubble-dismissed";

/**
 * Floating "chat with admin" WhatsApp button with a dismissible greeting
 * bubble, fixed to the bottom-right of the public site. Renders nothing when
 * no number is configured. The bubble appears shortly after load and stays
 * dismissed for the session once closed.
 */
export function FloatingWhatsApp({
  phone,
  message = DEFAULT_MESSAGE,
  greeting,
}: {
  phone: string;
  message?: string;
  greeting?: string;
}) {
  const digits = phone.replace(/\D/g, "");
  const [showBubble, setShowBubble] = useState(false);

  useEffect(() => {
    if (!digits) return;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // ignore
    }
    if (dismissed) return;
    const timer = setTimeout(() => setShowBubble(true), 1500);
    return () => clearTimeout(timer);
  }, [digits]);

  if (!digits) return null;

  const href = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  const text = greeting?.trim() || DEFAULT_GREETING;

  function dismiss() {
    setShowBubble(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {showBubble && (
        <div className="flex items-center gap-1 rounded-full border bg-card py-2 pl-4 pr-2 shadow-lg">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-foreground"
          >
            {text}
          </a>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Tutup"
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat dengan admin di WhatsApp"
        title="Chat dengan admin"
        className="flex h-14 w-14 items-center justify-center self-end rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-7 w-7"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      </a>
    </div>
  );
}
