import { cn } from "@/lib/utils";

/**
 * The ihsanku brand mark: four rounded petals in a clover, navy on one
 * diagonal and light blue on the other, the navy pair overlapping the blue at
 * the centre. Same geometry as /logo-icon.svg. The navy petals lighten in dark
 * mode so the mark keeps its contrast; the light-blue ones stay vivid.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="ihsanku"
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse cx="72" cy="28" rx="30" ry="22" transform="rotate(-45 72 28)" className="fill-[#24b2e8]" />
      <ellipse cx="28" cy="72" rx="30" ry="22" transform="rotate(-45 28 72)" className="fill-[#24b2e8]" />
      <ellipse cx="28" cy="28" rx="30" ry="22" transform="rotate(45 28 28)" className="fill-[#1b2a5b] dark:fill-slate-100" />
      <ellipse cx="72" cy="72" rx="30" ry="22" transform="rotate(45 72 72)" className="fill-[#1b2a5b] dark:fill-slate-100" />
    </svg>
  );
}

/** Full ihsanku logo (mark + wordmark) from the uploaded brand asset. */
export function Logo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-ihsanku.svg"
      alt="ihsanku"
      width={4465}
      height={1457}
      className={cn(
        "w-auto",
        size === "sm" ? "h-7" : size === "lg" ? "h-12" : "h-9",
        className
      )}
    />
  );
}
