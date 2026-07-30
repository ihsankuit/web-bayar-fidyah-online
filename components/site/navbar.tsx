import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/site/logo";
import { MobileNav } from "@/components/site/mobile-nav";

const links = [
  { href: "/#kira", label: "Kalkulator" },
  { href: "/#hukum", label: "Hukum" },
  { href: "/#kategori", label: "Kategori" },
  { href: "/#qada-fidyah", label: "Qada' & Fidyah" },
  { href: "/#cara-kira", label: "Cara Kira" },
  { href: "/blog", label: "Blog" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" aria-label="ihsanku" className="mr-2">
          <Logo size="lg" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex ml-4">
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

        <div className="flex items-center gap-1">
          <Button asChild size="sm">
            <Link href="/#kira">Bayar Sekarang</Link>
          </Button>
          <MobileNav links={links} />
        </div>
      </div>
    </header>
  );
}
