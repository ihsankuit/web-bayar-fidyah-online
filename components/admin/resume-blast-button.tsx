"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlayCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { BlastProgress } from "@/components/admin/blast-progress";

export function ResumeBlastButton({
  blastId,
  total,
  sentCount,
  failedCount,
}: {
  blastId: string;
  total: number;
  sentCount: number;
  failedCount: number;
}) {
  const [active, setActive] = useState(false);
  const router = useRouter();

  if (active) {
    return (
      <BlastProgress
        blastId={blastId}
        total={total}
        initialSent={sentCount}
        initialFailed={failedCount}
        onDone={() => {
          toast.success("Blast selesai dihantar.");
          router.refresh();
        }}
      />
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={() => setActive(true)}>
      <PlayCircle className="h-4 w-4" /> Sambung
    </Button>
  );
}
