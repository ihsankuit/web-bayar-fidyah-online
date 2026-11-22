"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Contact,
  FileText,
  GalleryHorizontalEnd,
  Gift,
  HeartHandshake,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  PanelsTopLeft,
  Plug,
  Search,
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
import { Logo, LogoMark } from "@/components/site/logo";

type NavItem = { href: string; label: string; icon: typeof Wallet; exact?: boolean };

// Grouped, with a divider between groups instead of headings: quieter, and it
// still lets the collapsed rail show where one kind of page ends.
const navGroups: NavItem[][] = [
  [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/admin/sumbangan", label: "Sumbangan", icon: Wallet },
    { href: "/admin/pembayar", label: "Pembayar", icon: Contact },
    { href: "/admin/agihan", label: "Agihan Fidyah", icon: MessageCircle },
    { href: "/admin/update-agihan", label: "Update Agihan", icon: HeartHandshake },
  ],
  [
    { href: "/admin/blog", label: "Blog", icon: FileText },
    { href: "/admin/galeri", label: "Galeri", icon: GalleryHorizontalEnd },
    { href: "/admin/media", label: "Media", icon: ImageIcon },
    { href: "/admin/laman", label: "Laman Utama", icon: PanelsTopLeft },
    { href: "/admin/seo", label: "SEO", icon: Search },
  ],
  [
    { href: "/admin/kempen", label: "Kempen Naik Taraf", icon: Gift },
    { href: "/admin/notifikasi", label: "Notifikasi", icon: Bell },
    { href: "/admin/integrasi", label: "Integrasi", icon: Plug },
  ],
  [
    { href: "/admin/log", label: "Log Aktiviti", icon: History },
    { href: "/admin/keselamatan", label: "Keselamatan", icon: ShieldCheck },
    { href: "/admin/pentadbir", label: "Pentadbir", icon: Users },
  ],
];

type Tip = { label: string; top: number; left: number } | null;

function NavLinks({
  onNavigate,
  collapsed = false,
  onTip,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onTip?: (tip: Tip) => void;
}) {
  const pathname = usePathname();

  const show = (el: HTMLElement, label: string) => {
    if (!collapsed || !onTip) return;
    const r = el.getBoundingClientRect();
    onTip({ label, top: r.top + r.height / 2, left: r.right + 10 });
  };

  return (
    <nav
      aria-label="Menu admin"
      className={cn("flex-1 overflow-y-auto px-3 py-3", collapsed ? "space-y-1" : "space-y-1")}
    >
      {navGroups.map((group, gi) => (
        <div key={gi} className="space-y-1">
          {gi > 0 && <div className="mx-2 my-3 h-px bg-border/60" />}
          {group.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-label={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                onMouseEnter={(e) => show(e.currentTarget, item.label)}
                onFocus={(e) => show(e.currentTarget, item.label)}
                onMouseLeave={() => onTip?.(null)}
                onBlur={() => onTip?.(null)}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-xl text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-0" : "px-3",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.25 : 1.75} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SignOutButton({
  email,
  className,
  collapsed = false,
}: {
  email: string;
  className?: string;
  collapsed?: boolean;
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
      {!collapsed && (
        <p className="truncate px-2 text-xs text-muted-foreground" title={email}>
          {email}
        </p>
      )}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-10 w-full rounded-xl text-muted-foreground",
          collapsed ? "justify-center px-0" : "justify-start"
        )}
        onClick={signOut}
        aria-label="Log keluar"
        title={collapsed ? `Log keluar (${email})` : undefined}
      >
        <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
        {!collapsed && "Log Keluar"}
      </Button>
    </div>
  );
}

const COLLAPSE_KEY = "admin-sidebar-collapsed";
const COLLAPSE_EVENT = "admin-sidebar-collapse-change";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeCollapsed(cb: () => void) {
  window.addEventListener(COLLAPSE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function Sidebar({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState<Tip>(null);
  // Remembered per browser. The server (and first paint) always renders it
  // expanded; useSyncExternalStore swaps in the saved choice after hydration
  // without a mismatch.
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);

  const toggle = () => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1");
    } catch {
      /* private mode: the choice just won't persist */
    }
    setTip(null);
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border/60 bg-card transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex",
          collapsed ? "w-[76px]" : "w-64"
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-border/60",
            collapsed ? "justify-center" : "px-5"
          )}
        >
          {collapsed ? <LogoMark className="h-8 w-8" /> : <Logo size="sm" />}
        </div>
        <NavLinks collapsed={collapsed} onTip={setTip} />
        <SignOutButton email={email} collapsed={collapsed} />

        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Kembangkan menu" : "Kecilkan menu"}
          aria-expanded={!collapsed}
          className="absolute -right-3 top-[4.5rem] z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>

        {collapsed && tip && (
          <div
            role="tooltip"
            className="pointer-events-none fixed z-50 -translate-y-1/2 whitespace-nowrap rounded-lg border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-md"
            style={{ top: tip.top, left: tip.left }}
          >
            {tip.label}
          </div>
        )}
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
