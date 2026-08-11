import type { Metadata } from "next";
import Link from "next/link";

import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { ORG, ORG_ADDRESS_LINE } from "@/lib/organization";

export const metadata: Metadata = {
  title: "Dasar Privasi",
  description:
    "Bagaimana Pertubuhan Ihsanku Malaysia mengumpul, menggunakan dan melindungi data peribadi anda di Bayar Fidyah Online, selaras dengan PDPA 2010.",
  alternates: { canonical: "/privasi" },
};

/**
 * Privacy policy. Kept in code rather than the CMS on purpose: a legal
 * document needs a dated, reviewable history of exactly what it said, which
 * git gives and an editable settings field does not.
 *
 * The contents describe what the application genuinely does — every item
 * below maps to a real column, upload bucket or outbound integration. Update
 * this page in the same change as any new data collection.
 */
const LAST_UPDATED = "11 Ogos 2026";

export default function PrivasiPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-16">
          <h1 className="text-4xl font-bold tracking-tight">Dasar Privasi</h1>
          <p className="mt-3 text-muted-foreground">
            Kemas kini terakhir: {LAST_UPDATED}
          </p>

          <div className="mt-10 space-y-8 leading-relaxed text-foreground/90">
            <section className="space-y-3">
              <p>
                Laman <strong>Bayar Fidyah Online</strong> dikendalikan oleh{" "}
                <strong>{ORG.name}</strong>. Dasar ini menerangkan data peribadi
                yang kami kumpul, sebab kami mengumpulnya, dan hak anda ke
                atasnya — selaras dengan{" "}
                <strong>Akta Perlindungan Data Peribadi 2010 (PDPA)</strong>.
              </p>
            </section>

            <Section title="1. Data yang kami kumpul">
              <p>Apabila anda menunaikan fidyah, kami merekod:</p>
              <List
                items={[
                  "Nama, alamat emel dan (jika diisi) nombor telefon anda.",
                  "Negeri anda, jika dipilih.",
                  "Butiran fidyah: kategori, bilangan hari, gandaan, kadar dan jumlah bayaran.",
                  "Mesej atau catatan yang anda tulis sendiri pada borang.",
                  "Bagi pindahan bank manual: bukti pembayaran yang anda muat naik.",
                ]}
              />
              <p>
                Secara automatik, pelayar anda turut memberikan{" "}
                <strong>alamat IP</strong>, <strong>jenis pelayar</strong>{" "}
                (user agent), <strong>halaman rujukan</strong>, dan{" "}
                <strong>parameter kempen (UTM)</strong> serta pengecam kuki
                pengiklanan jika ada. Ini digunakan untuk keselamatan, mengesan
                penyalahgunaan, dan mengukur keberkesanan kempen.
              </p>
            </Section>

            <Section title="2. Tujuan penggunaan">
              <List
                items={[
                  "Memproses pembayaran fidyah anda dan mengeluarkan resit rasmi.",
                  "Menghantar resit dan kemas kini agihan fidyah melalui emel atau WhatsApp.",
                  "Menghubungi anda jika pembayaran tergantung atau gagal.",
                  "Menyimpan rekod kewangan dan audit seperti yang dikehendaki.",
                  "Menambah baik laman dan mengukur keberkesanan kempen.",
                ]}
              />
              <p>
                Kami <strong>tidak menjual</strong> data peribadi anda kepada
                sesiapa.
              </p>
            </Section>

            <Section title="3. Pihak ketiga yang memproses data">
              <p>
                Kami berkongsi hanya apa yang perlu, dengan penyedia
                perkhidmatan berikut:
              </p>
              <List
                items={[
                  "CHIP — gerbang pembayaran. Menerima nama, emel dan telefon untuk memproses transaksi. Kami tidak menyimpan maklumat kad anda.",
                  "Resend — penghantaran emel resit dan peringatan.",
                  "Murpati — penghantaran notifikasi WhatsApp, jika anda memberikan nombor telefon.",
                  "Supabase — hos pangkalan data dan storan fail.",
                  "Vercel — hos laman web.",
                  "Google (Analytics, Ads, Tag Manager) dan Meta (Facebook Pixel) — analitik dan pengukuran pengiklanan.",
                ]}
              />
            </Section>

            <Section title="4. Paparan nama di laman utama">
              <p>
                Laman utama memaparkan notifikasi sumbangan terkini yang
                menunjukkan <strong>nama pertama dan negeri sahaja</strong>{" "}
                (contoh: &quot;Ahmad dari Selangor&quot;). Nama penuh, jumlah
                bayaran, emel dan nombor telefon <strong>tidak pernah</strong>{" "}
                dipaparkan secara awam. Jika anda tidak mahu dipaparkan
                langsung, hubungi kami dan kami akan mengecualikan rekod anda.
              </p>
            </Section>

            <Section title="5. Resit dan pautan pembayaran">
              <p>
                Resit PDF dan pautan menyambung pembayaran anda boleh dicapai
                melalui nombor rujukan unik yang dihantar kepada anda. Sesiapa
                yang memiliki nombor rujukan tersebut boleh melihat resit
                berkenaan — jadi elakkan berkongsi pautan itu secara awam.
              </p>
            </Section>

            <Section title="6. Tempoh penyimpanan">
              <p>
                Rekod pembayaran disimpan sebagai rekod kewangan selagi
                diperlukan untuk tujuan perakaunan, audit dan keperluan
                undang-undang. Bukti pembayaran yang dimuat naik disimpan dalam
                storan peribadi dan hanya boleh dicapai oleh pentadbir yang
                dibenarkan.
              </p>
            </Section>

            <Section title="7. Keselamatan">
              <p>
                Semua data dihantar melalui sambungan disulitkan (HTTPS).
                Capaian pentadbir dilindungi kata laluan dan pengesahan dua
                faktor. Bukti pembayaran disimpan dalam baldi storan peribadi,
                bukan awam.
              </p>
            </Section>

            <Section title="8. Hak anda">
              <p>Di bawah PDPA, anda berhak untuk:</p>
              <List
                items={[
                  "Meminta akses kepada data peribadi anda yang kami simpan.",
                  "Meminta pembetulan data yang tidak tepat.",
                  "Menarik balik persetujuan untuk menerima komunikasi pemasaran.",
                  "Membuat aduan berkaitan pengendalian data anda.",
                ]}
              />
              <p>
                Untuk melaksanakan mana-mana hak di atas, hubungi kami
                menggunakan butiran di bawah. Sila ambil maklum bahawa rekod
                kewangan yang wajib disimpan di sisi undang-undang tidak boleh
                dipadam sepenuhnya.
              </p>
            </Section>

            <Section title="9. Kuki">
              <p>
                Kami menggunakan kuki untuk mengekalkan sesi anda dan mengukur
                trafik serta keberkesanan kempen melalui Google dan Meta. Anda
                boleh menyekat kuki melalui tetapan pelayar anda, tetapi
                sebahagian fungsi laman mungkin terjejas.
              </p>
            </Section>

            <Section title="10. Perubahan pada dasar ini">
              <p>
                Kami mungkin mengemas kini dasar ini dari semasa ke semasa.
                Tarikh kemas kini terakhir dipaparkan di atas.
              </p>
            </Section>

            <Section title="11. Hubungi kami">
              <address className="space-y-1 not-italic">
                <p className="font-medium">{ORG.name}</p>
                <p className="text-muted-foreground">{ORG_ADDRESS_LINE}</p>
                <p>
                  <a
                    href={`tel:${ORG.phoneE164}`}
                    className="text-primary-strong underline underline-offset-4"
                  >
                    {ORG.phoneDisplay}
                  </a>
                </p>
                <p>
                  <a
                    href={ORG.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-strong underline underline-offset-4"
                  >
                    ihsanku.org
                  </a>
                </p>
              </address>
            </Section>
          </div>

          <div className="mt-12 border-t border-border pt-6">
            <Link
              href="/"
              className="text-sm text-primary-strong underline underline-offset-4"
            >
              Kembali ke laman utama
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6 marker:text-muted-foreground">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
