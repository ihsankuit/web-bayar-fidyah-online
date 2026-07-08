import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  HeartHandshake,
  Receipt,
  ShieldCheck,
  Sparkles,
  Wallet,
  XCircle,
} from "lucide-react";

import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { FidyahForm } from "@/components/site/fidyah-form";
import { Gallery } from "@/components/site/gallery";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FIDYAH_CATEGORIES, QADA_FIDYAH_SITUATIONS } from "@/lib/fidyah";
import { getLandingContent } from "@/lib/settings";
import { getGalleryItems } from "@/lib/gallery";
import { formatMYR } from "@/lib/utils";

export default async function HomePage() {
  const [content, gallery] = await Promise.all([
    getLandingContent(),
    getGalleryItems(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent)]" />
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
            <div className="space-y-6">
              <Badge
                variant="secondary"
                className="gap-1.5 text-primary"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {content.hero_badge}
              </Badge>
              <h1 className="text-balance text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                {content.hero_title}
              </h1>
              <p className="max-w-lg text-pretty text-lg text-muted-foreground">
                {content.hero_subtitle}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="#kira">
                    {content.hero_cta}
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="#hukum">Ketahui Lebih Lanjut</Link>
                </Button>
              </div>

              <dl className="grid grid-cols-3 gap-4 pt-4">
                {content.stats.map((s) => (
                  <div key={s.label}>
                    <dt className="text-sm text-muted-foreground">{s.label}</dt>
                    <dd className="text-2xl font-bold text-primary">
                      {s.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div id="kira" className="scroll-mt-20">
              <FidyahForm rateSen={content.fidyah_rate_sen} />
            </div>
          </div>
        </section>

        {/* Trust badges */}
        <section className="border-y border-border/60 bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3">
            <Feature
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Selamat & Dipercayai"
              desc="Pembayaran melalui gerbang Billplz yang menyokong FPX & kad."
            />
            <Feature
              icon={<Receipt className="h-5 w-5" />}
              title="Resit Automatik"
              desc="Resit rasmi dihantar terus ke emel anda selepas pembayaran."
            />
            <Feature
              icon={<Wallet className="h-5 w-5" />}
              title="Kiraan Tepat"
              desc="Kalkulator automatik mengikut hari & gandaan qada'."
            />
          </div>
        </section>

        {/* Hukum Fidyah */}
        <section id="hukum" className="scroll-mt-20 py-16 lg:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {content.hukum_title}
            </h2>
            <div className="mt-8 space-y-5 text-lg text-muted-foreground">
              {content.hukum_body
                .split(/\n\n+/)
                .filter(Boolean)
                .map((para, i) => (
                  <p key={i} className="text-pretty">
                    {renderBold(para)}
                  </p>
                ))}
            </div>

            <figure className="mt-10 rounded-2xl border bg-card p-8 shadow-sm">
              <p
                dir="rtl"
                lang="ar"
                className="text-2xl leading-[2.4] text-foreground sm:text-3xl"
              >
                {content.hadith_arabic}
              </p>
              <figcaption className="mt-6 text-sm italic text-muted-foreground">
                Yang bermaksud: &ldquo;{content.hadith_meaning}&rdquo; (
                {content.hadith_source})
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Categories */}
        <section id="kategori" className="scroll-mt-20 bg-muted/30 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Siapa Yang Wajib Membayar Fidyah?
              </h2>
              <p className="mt-3 text-muted-foreground">
                Fidyah dikenakan ke atas golongan berikut yang meninggalkan
                puasa Ramadan.
              </p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FIDYAH_CATEGORIES.filter((c) => c.id !== "lain").map((c) => (
                <Card key={c.id} className="h-full">
                  <CardContent className="space-y-3 p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <HeartHandshake className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold">{c.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {c.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Qada' vs Fidyah reference table */}
        <section id="qada-fidyah" className="scroll-mt-20 py-16 lg:py-24">
          <div className="mx-auto max-w-5xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Situasi Dikenakan Qada&apos; &amp; Fidyah
              </h2>
              <p className="mt-3 text-muted-foreground">
                Rujuk jadual berikut untuk kenal pasti sama ada anda perlu
                mengqada&apos; puasa, membayar fidyah, atau kedua-duanya.
              </p>
            </div>
            <div className="mt-12 overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Situasi</TableHead>
                    <TableHead className="text-center">Kena Qada&apos;?</TableHead>
                    <TableHead className="text-center">Kena Fidyah?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {QADA_FIDYAH_SITUATIONS.map((row) => (
                    <TableRow key={row.situation}>
                      <TableCell className="max-w-md">{row.situation}</TableCell>
                      <TableCell className="text-center">
                        <YesNoIcon value={row.kenaQada} />
                      </TableCell>
                      <TableCell className="text-center">
                        <YesNoIcon value={row.kenaFidyah} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </section>

        {/* Cara Kira Fidyah */}
        <section id="cara-kira" className="scroll-mt-20 bg-muted/30 py-16 lg:py-24">
          <div className="mx-auto max-w-4xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Cara Kira Fidyah
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                {renderBold(
                  "Kadar bayaran fidyah ialah sebanyak **secupak atau 700 gram makanan asasi** seperti beras, iaitu bayaran untuk 1 hari puasa yang ditinggalkan."
                )}
              </p>
            </div>

            <div className="mt-12 overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="grid md:grid-cols-2">
                {/* Situasi 1 */}
                <div className="p-8">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      1
                    </span>
                    <h3 className="text-lg font-bold">Situasi 1</h3>
                  </div>
                  <p className="mt-4 text-muted-foreground">
                    Aisha belum menggantikan puasa sehingga memasuki Ramadan
                    berikutnya pada tahun 1446H (2026).
                  </p>
                  <p className="mt-6 text-sm text-muted-foreground">
                    Formula Kiraan:
                  </p>
                  <p className="mt-1 font-semibold text-primary">
                    [Bilangan Hari Tidak Berpuasa × Kadar Fidyah]
                  </p>
                  <div className="mt-4 inline-flex rounded-lg bg-primary/10 px-4 py-2 font-bold text-primary">
                    7 hari × {formatMYR(content.fidyah_rate_sen)} ={" "}
                    {formatMYR(7 * content.fidyah_rate_sen)}
                  </div>
                </div>

                {/* Situasi 2 */}
                <div className="border-t p-8 md:border-l md:border-t-0">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      2
                    </span>
                    <h3 className="text-lg font-bold">Situasi 2</h3>
                  </div>
                  <p className="mt-4 text-muted-foreground">
                    Aisha belum menggantikan puasa sehingga memasuki beberapa
                    Ramadan tahun-tahun berikutnya — beliau tidak berpuasa pada
                    Ramadan 1444H (2023) dan masih belum berganti sehingga 1447H
                    (2026), serta berkemampuan untuk menggandakan bayaran fidyah.
                  </p>
                  <p className="mt-6 text-sm text-muted-foreground">
                    Formula Kiraan:
                  </p>
                  <p className="mt-1 font-semibold text-primary">
                    [(Bilangan Hari Tidak Berpuasa × Kadar Fidyah) × Bilangan
                    Tahun Yang Ditinggalkan]
                  </p>
                  <div className="mt-4 inline-flex rounded-lg bg-primary/10 px-4 py-2 font-bold text-primary">
                    (7 hari × {formatMYR(content.fidyah_rate_sen)}) × 3 Tahun ={" "}
                    {formatMYR(7 * content.fidyah_rate_sen * 3)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Bayar dalam 3 Langkah Mudah
              </h2>
            </div>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {[
                {
                  n: "1",
                  t: "Kira jumlah",
                  d: "Masukkan bilangan hari dan gandaan qada' untuk mengira jumlah fidyah.",
                },
                {
                  n: "2",
                  t: "Isi butiran & bayar",
                  d: "Lengkapkan maklumat anda dan buat pembayaran selamat melalui FPX atau kad.",
                },
                {
                  n: "3",
                  t: "Terima resit",
                  d: "Resit rasmi dihantar terus ke emel anda sebagai pengesahan.",
                },
              ].map((step) => (
                <div key={step.n} className="relative space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                    {step.n}
                  </div>
                  <h3 className="text-lg font-semibold">{step.t}</h3>
                  <p className="text-muted-foreground">{step.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Galeri */}
        {gallery.length > 0 && (
          <section id="galeri" className="scroll-mt-20 bg-muted/30 py-16 lg:py-24">
            <div className="mx-auto max-w-6xl px-4">
              <div className="mx-auto max-w-2xl text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Galeri
                </h2>
                <p className="mt-3 text-muted-foreground">
                  Koleksi gambar dan video aktiviti serta program kami.
                </p>
              </div>
              <div className="mt-12">
                <Gallery items={gallery} />
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 py-16 lg:py-24">
          <div className="mx-auto max-w-3xl px-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Soalan Lazim
              </h2>
            </div>
            <div className="mt-10 space-y-4">
              {content.faqs.map((faq, i) => (
                <details
                  key={i}
                  className="group rounded-xl border bg-card p-5 [&_summary]:cursor-pointer"
                >
                  <summary className="flex items-center justify-between font-semibold marker:content-['']">
                    {faq.question}
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary opacity-0 transition-opacity group-open:opacity-100" />
                  </summary>
                  <p className="mt-3 text-muted-foreground">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 lg:py-24">
          <div className="mx-auto max-w-5xl px-4">
            <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-16">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_50%_at_50%_0%,rgba(255,255,255,.15),transparent)]" />
              <h2 className="text-balance text-3xl font-bold sm:text-4xl">
                Tunaikan Tanggungan Fidyah Anda Hari Ini
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
                Jangan tangguhkan lagi. Selesaikan fidyah anda dengan mudah dan
                selamat dalam beberapa minit sahaja.
              </p>
              <Button asChild size="lg" variant="secondary" className="mt-8">
                <Link href="#kira">
                  {content.hero_cta}
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer note={content.footer_note} />
    </div>
  );
}

function YesNoIcon({ value }: { value: boolean }) {
  return value ? (
    <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-500" />
  ) : (
    <XCircle className="mx-auto h-5 w-5 text-destructive" />
  );
}

/** Renders plain text with `**bold**` segments emphasised. */
function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-bold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function Feature({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
