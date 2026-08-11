import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { Globe, MapPin, Phone } from "lucide-react";
import { ORG, ORG_ADDRESS_LINE } from "@/lib/organization";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-sm space-y-10">
            <Link href="/" aria-label="ihsanku" className="inline-block">
              <Logo size="lg" />
            </Link>
            <p className="text-sm text-muted-foreground">
              Platform pembayaran fidyah yang dikuasakan oleh Pertubuhan
              Ihsanku Malaysia. Setiap fidyah disalurkan kepada projek Dapur
              Ihsan untuk golongan asnaf dan fakir miskin di Malaysia dan luar
              negara.
            </p>

            {/* Visible NAP, matching the Google Business Profile exactly.
                Local ranking leans on this being crawlable on the page, not
                only inside JSON-LD — and it doubles as a trust signal for a
                site that takes payments. */}
            <address className="space-y-2 text-sm not-italic text-muted-foreground">
              <p className="font-medium text-foreground">{ORG.name}</p>
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{ORG_ADDRESS_LINE}</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <a
                  href={`tel:${ORG.phoneE164}`}
                  className="transition-colors hover:text-foreground"
                >
                  {ORG.phoneDisplay}
                </a>
              </p>
              <p className="flex items-center gap-2">
                <Globe className="h-4 w-4 shrink-0" />
                <a
                  href={ORG.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-foreground"
                >
                  ihsanku.org
                </a>
              </p>
            </address>
          </div>

          <div className="grid grid-cols-2 gap-8">
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
      <h3 className="text-sm font-semibold">{title}</h3>
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
