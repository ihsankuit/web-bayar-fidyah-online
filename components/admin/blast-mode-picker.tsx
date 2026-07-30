"use client";

import { Rabbit, ShieldCheck, SlidersHorizontal, Turtle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WhatsappBlastDelayMode } from "@/lib/database.types";

const PRESETS: {
  id: WhatsappBlastDelayMode;
  label: string;
  desc: string;
  detail: string;
  icon: typeof Rabbit;
}[] = [
  {
    id: "yolo",
    label: "YOLO",
    desc: "Laju & pantas",
    detail: "Jeda 1–15 saat",
    icon: Rabbit,
  },
  {
    id: "medium",
    label: "Sederhana",
    desc: "Pendekatan seimbang",
    detail: "Jeda 15–60 saat",
    icon: SlidersHorizontal,
  },
  {
    id: "careful",
    label: "Berhati-hati",
    desc: "Selamat & perlahan",
    detail: "Jeda 1–3 minit",
    icon: Turtle,
  },
  {
    id: "custom",
    label: "Custom",
    desc: "Kawalan penuh",
    detail: "Tetapkan sendiri",
    icon: ShieldCheck,
  },
];

export function BlastModePicker({
  mode,
  onModeChange,
  customMinSec,
  customMaxSec,
  onCustomChange,
  disabled,
}: {
  mode: WhatsappBlastDelayMode;
  onModeChange: (mode: WhatsappBlastDelayMode) => void;
  customMinSec: number;
  customMaxSec: number;
  onCustomChange: (min: number, max: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Kelajuan Hantar</Label>
        <p className="text-xs text-muted-foreground">
          Jeda lebih pantas berisiko disekat WhatsApp bagi senarai besar;
          lebih perlahan lebih selamat tapi ambil masa lebih lama.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PRESETS.map((p) => {
          const Icon = p.icon;
          const active = mode === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => onModeChange(p.id)}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                active
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              />
              <div className="mt-1.5 font-medium">{p.label}</div>
              <div className="text-xs text-muted-foreground">{p.desc}</div>
              <div className="mt-1 text-xs text-muted-foreground">{p.detail}</div>
            </button>
          );
        })}
      </div>

      {mode === "custom" && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3">
          <div className="space-y-1">
            <Label htmlFor="custom_min" className="text-xs">
              Jeda minimum (saat)
            </Label>
            <Input
              id="custom_min"
              type="number"
              min={1}
              max={600}
              disabled={disabled}
              value={customMinSec}
              onChange={(e) =>
                onCustomChange(Number(e.target.value) || 1, customMaxSec)
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="custom_max" className="text-xs">
              Jeda maksimum (saat)
            </Label>
            <Input
              id="custom_max"
              type="number"
              min={customMinSec}
              max={600}
              disabled={disabled}
              value={customMaxSec}
              onChange={(e) =>
                onCustomChange(customMinSec, Number(e.target.value) || customMinSec)
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
