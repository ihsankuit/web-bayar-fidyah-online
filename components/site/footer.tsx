import Link from "next/link";
import { Logo } from "@/components/site/logo";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-sm space-y-10">
            <Link href="/" aria-label="ihsanku">
              <Logo size="lg" />
            </Link>
            <p className="text-sm text-muted-foreground">
              Platform pembayaran fidyah yang dikuasakan oleh Pertubuhan
              Ihsanku Malaysia. Setiap fidyah disalurkan kepada projek Dapur
              Ihsan untuk golongan asnaf dan fakir miskin di Malaysia dan luar
              negara.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterCol title="Laman">
              <FooterLink href="/#kira">Kalkulator</FooterLink>
              <FooterLink href="/#hukum">Hukum Fidyah</FooterLink>
              <FooterLink href="/#cara-kira">Cara Kira</FooterLink>
              <FooterLink href="/#faq">Soalan Lazim</FooterLink>
            </FooterCol>
            <FooterCol title="Sumber">
              <FooterLink href="/blog">Blog</FooterLink>
              <FooterLink href="/#galeri">Galeri</FooterLink>
              <FooterLink href="/#kategori">Kategori</FooterLink>
            </FooterCol>
            <FooterCol title="Pentadbir">
              <FooterLink href="/admin">Log Masuk Admin</FooterLink>
            </FooterCol>
          </div>
        </div>

        <div className="mt-10 border-t border-border/60 pt-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Bayar Fidyah Online. Semua hak
          terpelihara.
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        {children}
      </Link>
    </li>
  );
}
