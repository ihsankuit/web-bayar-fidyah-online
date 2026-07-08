import Link from "next/link";
import { Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/#kira", label: "Kalkulator" },
  { href: "/#hukum", label: "Hukum" },
  { href: "/#kategori", label: "Kategori" },
  { href: "/#qada-fidyah", label: "Qada' & Fidyah" },
  { href: "/#faq", label: "Soalan Lazim" },
  { href: "/blog", label: "Blog" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Moon className="h-5 w-5" />
          </span>
          <span className="text-lg tracking-tight">
            Bayar<span className="text-primary">Fidyah</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Button asChild size="sm">
          <Link href="/#kira">Bayar Sekarang</Link>
        </Button>
      </div>
    </header>
  );
}
