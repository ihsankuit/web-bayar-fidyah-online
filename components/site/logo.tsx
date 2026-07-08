import { cn } from "@/lib/utils";

const PETAL = "M0 0C10 -4 11 -16 0 -21C-11 -16 -10 -4 0 0Z";

/**
 * The ihsanku brand mark — a four-petal pinwheel/butterfly. The two light-blue
 * petals stay vivid in both themes; the navy petals lighten in dark mode so the
 * mark keeps its contrast against the dark navy surface.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="ihsanku"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(24 24)">
        <path d={PETAL} transform="rotate(45)" className="fill-[#24b2e8]" />
        <path
          d={PETAL}
          transform="rotate(135)"
          className="fill-[#1b2a5b] dark:fill-slate-100"
        />
        <path d={PETAL} transform="rotate(225)" className="fill-[#24b2e8]" />
        <path
          d={PETAL}
          transform="rotate(315)"
          className="fill-[#1b2a5b] dark:fill-slate-100"
        />
      </g>
    </svg>
  );
}

/** Full logo: mark + "ihsanku" wordmark. */
export function Logo({
  size = "md",
  className,
}: {
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark className={size === "sm" ? "h-7 w-7" : "h-8 w-8"} />
      <span
        className={cn(
          "font-extrabold lowercase tracking-tight text-foreground",
          size === "sm" ? "text-base" : "text-lg"
        )}
      >
        ihsan<span className="italic">ku</span>
      </span>
    </span>
  );
}
