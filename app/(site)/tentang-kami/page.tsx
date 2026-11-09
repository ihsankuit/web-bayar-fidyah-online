import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, HandHeart, Receipt, ShieldCheck } from "lucide-react";

import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { ORG, ORG_ADDRESS_LINE, ORG_SAME_AS } from "@/lib/organization";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Tentang Kami — Pertubuhan Ihsanku Malaysia",
  description:
    "Bayar Fidyah Online dikendalikan oleh Pertubuhan Ihsanku Malaysia. Ketahui siapa kami, ke mana fidyah anda disalurkan, dan bagaimana pembayaran anda dilindungi.",
  alternates: { canonical: "/tentang-kami" },
};

/**
 * About page.
 *
 * A site that collects money without one is a trust gap Google weighs
 * directly under its YMYL guidance, and payers feel it too. Every claim
 * here is one the site can stand behind: the operating organisation, the
 * NAP that matches the Google Business Profile, where the money goes, and
 * how payment is handled, including the ROS registration number. Facts the
 * code does not hold — founding year, names of religious reviewers — are
 * deliberately absent rather than invented.
 */
export default function TentangKamiPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Laman Utama", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Tentang Kami",
        item: `${SITE_URL}/tentang-kami`,
      },
    ],
  };

  const aboutJsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    url: `${SITE_URL}/tentang-kami`,
    inLanguage: "ms",
    mainEntity: {
      "@type": ORG.schemaType,
      name: ORG.name,
      url: SITE_URL,
      logo: `${SITE_URL}${ORG.logoPath}`,
      telephone: ORG.phoneE164,
      address: {
        "@type": "PostalAddress",
        streetAddress: ORG.streetAddress,
        addressLocality: ORG.locality,
        addressRegion: ORG.region,
        postalCode: ORG.postalCode,
        addressCountry: ORG.country,
      },
      sameAs: ORG_SAME_AS,
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />
      <Navbar />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="text-4xl font-bold tracking-tight">
            Tentang Bayar Fidyah Online
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Satu tempat untuk mengira dan menunaikan fidyah puasa anda, tanpa
            perlu ke pejabat agama atau beratur di kaunter.
          </p>

          <div className="mt-10 space-y-10 leading-relaxed text-foreground/90">
            <section className="space-y-3">
              <h2 className="text-2xl font-bold tracking-tight">
                Siapa kami
              </h2>
              <p>
                Laman ini dikendalikan oleh <strong>{ORG.name}</strong>, sebuah
                pertubuhan bukan untung yang berpangkalan di {ORG.locality},{" "}
                {ORG.region}. Kami membina platform ini kerana proses menunaikan
                fidyah sering tersekat pada perkara yang sama: orang tidak pasti
                berapa jumlahnya, dan tidak tahu ke mana hendak membayarnya.
              </p>
              <p>
                Berdaftar dengan Jabatan Pendaftaran Pertubuhan Malaysia (ROS):{" "}
                <strong>{ORG.rosNumber}</strong>
              </p>
              <p>
                Maklumat lanjut mengenai aktiviti pertubuhan ada di{" "}
                <a
                  href={ORG.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary-strong underline underline-offset-4"
                >
                  ihsanku.org
                </a>
                .
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-bold tracking-tight">
                Ke mana fidyah anda disalurkan
              </h2>
              <p>
                Setiap pembayaran fidyah yang diterima disalurkan kepada projek{" "}
                <strong>Dapur Ihsan</strong>, iaitu program pemberian makanan
                kepada golongan asnaf dan fakir miskin di Malaysia dan luar
                negara.
              </p>
              <p>
                Ini selari dengan tuntutan fidyah itu sendiri — memberi makan
                kepada orang miskin bagi setiap hari puasa yang ditinggalkan.
                Fidyah anda tidak menjadi sumbangan umum; ia ditunaikan mengikut
                tujuan asalnya.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight">
                Bagaimana pembayaran anda dilindungi
              </h2>
              <div className="space-y-4">
                <Point
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="Gerbang pembayaran berlesen"
                >
                  Pembayaran diproses melalui gerbang CHIP, yang menyokong FPX,
                  kad kredit/debit dan QR. Kami tidak menyimpan butiran kad atau
                  maklumat perbankan anda — semua itu kekal di pihak gerbang.
                </Point>
                <Point
                  icon={<Receipt className="h-5 w-5" />}
                  title="Resit automatik"
                >
                  Resit rasmi dihantar ke emel anda sebaik pembayaran berjaya,
                  dan boleh dimuat turun semula sebagai PDF pada bila-bila masa
                  menggunakan nombor rujukan anda.
                </Point>
                <Point
                  icon={<HandHeart className="h-5 w-5" />}
                  title="Kiraan yang boleh disemak"
                >
                  Kalkulator menunjukkan pecahan penuh sebelum anda membayar —
                  bilangan hari, gandaan qada&apos;, dan kadar sehari. Tiada caj
                  tersembunyi di atas jumlah fidyah anda.
                </Point>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-2xl font-bold tracking-tight">
                Maklumat pertubuhan
              </h2>
              <address className="space-y-1 not-italic text-muted-foreground">
                <p className="font-medium text-foreground">{ORG.name}</p>
                <p>{ORG_ADDRESS_LINE}</p>
                <p>
                  Telefon:{" "}
                  <a
                    href={`tel:${ORG.phoneE164}`}
                    className="text-primary-strong underline underline-offset-4"
                  >
                    {ORG.phoneDisplay}
                  </a>
                </p>
              </address>
              <p className="text-sm text-muted-foreground">
                Ada soalan sebelum membayar?{" "}
                <Link
                  href="/hubungi"
                  className="font-medium text-primary-strong underline underline-offset-4"
                >
                  Hubungi kami
                </Link>{" "}
                — kami lebih suka menjawab dahulu daripada awak tersilap bayar.
              </p>
            </section>

            <section className="rounded-xl border border-border bg-muted/40 p-6">
              <h2 className="text-xl font-bold tracking-tight">
                Sedia untuk menunaikan fidyah anda?
              </h2>
              <p className="mt-2 text-muted-foreground">
                Kalkulator mengira jumlah anda secara automatik. Mengambil masa
                beberapa minit sahaja.
              </p>
              <Button asChild className="mt-5">
                <Link href="/#kira">
                  Kira &amp; Bayar Fidyah
                  <ArrowRight />
                </Link>
              </Button>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}

function Point({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
