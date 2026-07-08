"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("URL disalin.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Gagal menyalin URL.");
    }
  }

  return (
    <Button variant="outline" size="sm" className="flex-1" onClick={copy}>
      {copied ? <Check /> : <Copy />}
      Salin URL
    </Button>
  );
}
