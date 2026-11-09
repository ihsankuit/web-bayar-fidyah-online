import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone, Receipt } from "lucide-react";

import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { getLandingContent } from "@/lib/settings";
import { ORG, ORG_ADDRESS_LINE } from "@/lib/organization";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Hubungi Kami",
  description:
    "Hubungi Pertubuhan Ihsanku Malaysia untuk sebarang pertanyaan mengenai pembayaran fidyah, resit, atau pembayaran yang tidak berjaya. WhatsApp, telefon dan alamat pejabat.",
  alternates: { canonical: "/hubungi" },
};

export const revalidate = 300;

/**
 * Contact page.
 *
 * Paired with Tentang Kami to close the trust gap on a site that takes
 * payments. The WhatsApp number comes from the landing settings so it stays
 * in step with the floating chat button rather than drifting from it, and
 * rows whose data is blank are omitted rather than rendered empty.
 */
export default async function HubungiPage() {
  const content = await getLandingContent();
  const whatsapp = content.whatsapp_number?.trim();
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    ORG.plusCode
  )}`;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Laman Utama", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Hubungi Kami",
        item: `${SITE_URL}/hubungi`,
      },
    ],
  };

  const contactJsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    url: `${SITE_URL}/hubungi`,
    inLanguage: "ms",
    mainEntity: {
      "@type": ORG.schemaType,
      name: ORG.name,
      url: SITE_URL,
      telephone: ORG.phoneE164,
      ...(ORG.email ? { email: ORG.email } : {}),
      address: {
        "@type": "PostalAddress",
        streetAddress: ORG.streetAddress,
        addressLocality: ORG.locality,
        addressRegion: ORG.region,
        postalCode: ORG.postalCode,
        addressCountry: ORG.country,
      },
      contactPoint: {
        "@type": "ContactPoint",
        telephone: ORG.phoneE164,
        contactType: "customer support",
        areaServed: "MY",
        availableLanguage: ["ms", "en"],
      },
    },
  };

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }}
      />
      <Navbar />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="text-4xl font-bold tracking-tight">Hubungi Kami</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Ada pertanyaan tentang fidyah, atau pembayaran yang tidak menjadi?
            Hubungi kami — kami jawab.
          </p>

          <div className="mt-10 space-y-4">
            {whatsapp && (
              <Row
                icon={<MessageCircle className="h-5 w-5" />}
                title="WhatsApp"
                hint="Cara paling pantas untuk dapatkan jawapan."
              >
                <a
                  href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary-strong underline underline-offset-4"
                >
                  Mesej kami di WhatsApp
                </a>
              </Row>
            )}

            <Row
              icon={<Phone className="h-5 w-5" />}
              title="Telefon"
              hint="Waktu pejabat, Isnin hingga Jumaat."
            >
              <a
                href={`tel:${ORG.phoneE164}`}
                className="font-medium text-primary-strong underline underline-offset-4"
              >
                {ORG.phoneDisplay}
              </a>
            </Row>

            {ORG.email && (
              <Row
                icon={<Mail className="h-5 w-5" />}
                title="Emel"
                hint="Sesuai untuk pertanyaan yang perlukan lampiran."
              >
                <a
                  href={`mailto:${ORG.email}`}
                  className="font-medium text-primary-strong underline underline-offset-4"
                >
                  {ORG.email}
                </a>
              </Row>
            )}

            <Row
              icon={<MapPin className="h-5 w-5" />}
              title="Pejabat"
              hint="Sila hubungi dahulu sebelum datang."
            >
              <address className="not-italic">
                <p className="font-medium text-foreground">{ORG.name}</p>
                <p className="text-muted-foreground">{ORG_ADDRESS_LINE}</p>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-sm font-medium text-primary-strong underline underline-offset-4"
                >
                  Lihat di Google Maps
                </a>
              </address>
            </Row>
          </div>

          <section className="mt-12 space-y-4 rounded-xl border border-border bg-muted/40 p-6">
            <div className="flex items-center gap-3">
              <Receipt className="h-5 w-5 text-primary-strong" />
              <h2 className="text-xl font-bold tracking-tight">
                Masalah dengan pembayaran?
              </h2>
            </div>
            <p className="text-muted-foreground">
              Sertakan <strong>nombor rujukan</strong> anda apabila menghubungi
              kami — ia bermula dengan <code className="rounded bg-muted px-1.5 py-0.5">FID-</code>{" "}
              dan ada dalam emel pengesahan anda. Dengan nombor itu kami boleh
              terus semak status pembayaran tanpa perlu bertanya balik.
            </p>
            <p className="text-sm text-muted-foreground">
              Anda juga boleh{" "}
              <Link
                href="/status"
                className="font-medium text-primary-strong underline underline-offset-4"
              >
                semak status pembayaran
              </Link>{" "}
              sendiri menggunakan nombor rujukan tersebut.
            </p>
          </section>

          <p className="mt-10 text-sm text-muted-foreground">
            Mahu tahu lebih lanjut tentang pertubuhan dan ke mana fidyah anda
            disalurkan?{" "}
            <Link
              href="/tentang-kami"
              className="font-medium text-primary-strong underline underline-offset-4"
            >
              Baca Tentang Kami
            </Link>
            .
          </p>
        </article>
      </main>
      <Footer />
    </div>
  );
}

function Row({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 rounded-xl border border-border p-5">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="font-semibold">{title}</h2>
        <div className="mt-1">{children}</div>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
