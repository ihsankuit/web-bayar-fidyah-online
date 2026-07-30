"use client";

import { useEffect, useState } from "react";

import { processBlastBatch } from "@/app/admin/(panel)/whatsapp/actions";

export function BlastProgress({
  blastId,
  total,
  initialSent = 0,
  initialFailed = 0,
  onDone,
}: {
  blastId: string;
  total: number;
  initialSent?: number;
  initialFailed?: number;
  onDone?: () => void;
}) {
  const [sent, setSent] = useState(initialSent);
  const [failed, setFailed] = useState(initialFailed);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      while (!cancelled) {
        const result = await processBlastBatch(blastId);
        if (cancelled) return;

        if (result.error) {
          setError(result.error);
          break;
        }

        setSent((s) => s + result.sent);
        setFailed((f) => f + result.failed);

        if (result.done) {
          setDone(true);
          onDone?.();
          break;
        }
        if (result.processed === 0) break;
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blastId]);

  const processed = sent + failed;
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 100;

  return (
    <div className="space-y-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {error
          ? `Ralat: ${error}`
          : done
            ? "Selesai."
            : "Sedang menghantar…"}{" "}
        {sent} berjaya, {failed} gagal, {Math.max(total - processed, 0)} baki
        daripada {total}.
      </p>
    </div>
  );
}
