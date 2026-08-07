"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText,
  GalleryHorizontalEnd,
  Gift,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  PanelsTopLeft,
  Plug,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Logo } from "@/components/site/logo";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/sumbangan", label: "Sumbangan", icon: Wallet },
  { href: "/admin/agihan", label: "Agihan Fidyah", icon: MessageCircle },
  { href: "/admin/blog", label: "Blog", icon: FileText },
  { href: "/admin/galeri", label: "Galeri", icon: GalleryHorizontalEnd },
  { href: "/admin/media", label: "Media", icon: ImageIcon },
  { href: "/admin/laman", label: "Laman Utama", icon: PanelsTopLeft },
  { href: "/admin/kempen", label: "Kempen Naik Taraf", icon: Gift },
  { href: "/admin/integrasi", label: "Integrasi", icon: Plug },
  { href: "/admin/log", label: "Log Aktiviti", icon: History },
  { href: "/admin/keselamatan", label: "Keselamatan", icon: ShieldCheck },
  { href: "/admin/pentadbir", label: "Pentadbir", icon: Users },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-1 p-3">
      {nav.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SignOutButton({
  email,
  className,
}: {
  email: string;
  className?: string;
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className={cn("space-y-2 border-t border-border/60 p-3", className)}>
      <p className="truncate px-2 text-xs text-muted-foreground" title={email}>
        {email}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={signOut}
      >
        <LogOut className="h-4 w-4" /> Log Keluar
      </Button>
    </div>
  );
}

export function Sidebar({ email }: { email: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border/60 bg-card lg:flex">
        <div className="flex h-16 items-center border-b border-border/60 px-5">
          <Logo size="sm" />
        </div>
        <NavLinks />
        <SignOutButton email={email} />
      </aside>

      {/* Mobile topbar + drawer */}
      <header className="flex h-16 w-full shrink-0 items-center justify-between border-b border-border/60 bg-card px-4 lg:hidden">
        <Logo size="sm" />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Buka menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-3/4 flex-col p-0 sm:max-w-xs">
            <SheetHeader className="border-b border-border/60 p-4">
              <SheetTitle>
                <Logo size="sm" />
              </SheetTitle>
            </SheetHeader>
            <NavLinks onNavigate={() => setOpen(false)} />
            <SignOutButton email={email} />
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}
