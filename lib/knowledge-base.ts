import { createClient } from "@/lib/supabase/public";
import { getLandingContent } from "@/lib/settings";
import {
  FIDYAH_CATEGORIES,
  NEGERI,
  QADA_FIDYAH_SITUATIONS,
} from "@/lib/fidyah";
import { ORG, ORG_ADDRESS_LINE } from "@/lib/organization";
import { RETIRED_BLOG_SLUGS } from "@/lib/blog-redirects";
import { SITE_URL } from "@/lib/site-url";
import { formatMYR } from "@/lib/utils";

/**
 * The site's own knowledge, as one plain-text document a chatbot can be fed.
 *
 * Generated from the live database rather than kept as a committed file, so
 * editing an FAQ answer or the fidyah rate in Admin updates what the bot
 * knows without anyone remembering to regenerate anything. A static export
 * would be stale the first time the rate changed — which is exactly the
 * number people most often ask a fidyah bot about.
 *
 * Doubles as /llms.txt, the convention AI crawlers look for.
 */

/** Published articles, newest first, minus the slugs that only redirect. */
async function articleList(): Promise<{ slug: string; title: string; excerpt: string | null }[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from("blog_posts")
      .select("slug,title,excerpt")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false });

    return ((data as { slug: string; title: string; excerpt: string | null }[]) ?? [])
      .filter((p) => !RETIRED_BLOG_SLUGS.has(p.slug));
  } catch {
    return [];
  }
}

export async function buildKnowledgeBase(): Promise<string> {
  const [content, articles] = await Promise.all([
    getLandingContent(),
    articleList(),
  ]);

  const rate = formatMYR(content.fidyah_rate_sen);
  const today = new Date().toISOString().slice(0, 10);
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines, "");

  push(
    `# ${ORG.name} — Bayar Fidyah Online`,
    "",
    `> Pangkalan pengetahuan rasmi untuk ${SITE_URL}. Dijana automatik pada ${today}.`
  );

  // Put the boundaries first. A bot that reads only the opening of a long
  // document should still come away knowing what it must not answer.
  push(
    "## Panduan untuk chatbot",
    "",
    "- Jawab dalam Bahasa Melayu melainkan pengguna bertanya dalam bahasa lain.",
    "- Platform ini mengendalikan **pembayaran fidyah sahaja**. Ia TIDAK mengutip zakat, sedekah umum, atau kaffarah.",
    "- Jangan mengeluarkan fatwa atau hukum baharu. Guna hanya maklumat dalam dokumen ini.",
    "- Hukum dan kadar fidyah berbeza mengikut negeri. Untuk kes khusus atau pertikaian hukum, rujuk pengguna kepada **pejabat mufti atau jabatan agama negeri** mereka.",
    "- Untuk apa-apa masalah pembayaran, minta **nombor rujukan** pengguna (bermula dengan `FID-`).",
    "- Jangan sesekali minta nombor kad kredit, kata laluan, atau OTP. Platform tidak pernah memintanya.",
    "- Jika tidak pasti, rujuk pengguna kepada talian rasmi di bahagian Hubungi."
  );

  push(
    "## Tentang organisasi",
    "",
    `- **Nama:** ${ORG.name}`,
    `- **Pendaftaran (ROS):** ${ORG.rosNumber}`,
    `- **Alamat:** ${ORG_ADDRESS_LINE}`,
    `- **Telefon:** ${ORG.phoneDisplay}`,
    `- **Laman utama organisasi:** ${ORG.website}`,
    `- **Platform fidyah:** ${SITE_URL}`,
    "",
    "Setiap pembayaran fidyah yang diterima disalurkan kepada projek **Dapur Ihsan**, iaitu program pemberian makanan kepada golongan asnaf dan fakir miskin di Malaysia dan luar negara. Ini selari dengan tuntutan fidyah itu sendiri — memberi makan orang miskin bagi setiap hari puasa yang ditinggalkan."
  );

  push(
    "## Kadar fidyah semasa",
    "",
    `- **Kadar yang digunakan oleh kalkulator laman ini: ${rate} sehari**, bagi setiap hari puasa yang ditinggalkan.`,
    "- Kadar ini mewakili nilai secupak (lebih kurang 700 gram) makanan asasi.",
    "- Kadar rasmi ditetapkan oleh pihak berkuasa agama setiap negeri dan boleh berbeza. Jika pengguna bertanya kadar rasmi negeri mereka, rujuk mereka kepada jabatan agama negeri berkenaan.",
    "",
    "**Formula:** jumlah = bilangan hari × gandaan tahun kelewatan × kadar sehari",
    "",
    `Contoh: 7 hari yang dilewatkan selama 3 tahun = 7 × 3 × ${rate} = ${formatMYR(
      7 * 3 * content.fidyah_rate_sen
    )}`
  );

  push(
    "## Siapa yang wajib membayar fidyah",
    "",
    ...FIDYAH_CATEGORIES.map((c) => `- **${c.title}** — ${c.description}`)
  );

  push(
    "## Qada' atau fidyah? Jadual rujukan",
    "",
    "| Situasi | Kena qada' | Kena fidyah |",
    "|---|---|---|",
    ...QADA_FIDYAH_SITUATIONS.map(
      (s) =>
        `| ${s.situation} | ${s.kenaQada ? "Ya" : "Tidak"} | ${
          s.kenaFidyah ? "Ya" : "Tidak"
        } |`
    )
  );

  const hukum = content.hukum_body?.replace(/\*\*/g, "").trim();
  if (hukum) {
    push(`## ${content.hukum_title || "Hukum fidyah"}`, "", hukum);
  }

  push(
    "## Cara membayar",
    "",
    "1. Buka kalkulator di " + `${SITE_URL}/#kira`,
    "2. Pilih kategori, masukkan bilangan hari puasa yang ditinggalkan dan gandaan tahun kelewatan.",
    "3. Jumlah dikira secara automatik dan dipaparkan sebelum bayaran.",
    "4. Isi nama, emel, dan nombor telefon (pilihan).",
    "5. Bayar melalui FPX (perbankan internet), kad kredit/debit, atau QR.",
    "6. Resit rasmi dihantar terus ke emel sebaik pembayaran berjaya.",
    "",
    "**Kaedah pembayaran:** FPX, kad kredit/debit, dan QR melalui gerbang pembayaran CHIP." +
      (content.bank_account_number
        ? " Pindahan bank manual juga disediakan."
        : ""),
    "",
    "Laman ini tidak menyimpan butiran kad atau maklumat perbankan — semuanya kekal di pihak gerbang pembayaran."
  );

  push(
    "## Resit dan status pembayaran",
    "",
    "- Resit rasmi dihantar ke emel secara automatik sebaik pembayaran berjaya.",
    `- Resit PDF boleh dimuat turun semula pada bila-bila masa di \`${SITE_URL}/resit/<nombor-rujukan>\`.`,
    `- Status pembayaran boleh disemak di \`${SITE_URL}/status\` menggunakan nombor rujukan.`,
    "- Nombor rujukan bermula dengan `FID-` dan ada dalam emel pengesahan.",
    "- Jika pembayaran tidak berjaya, pengguna boleh menyambung semula menggunakan pautan dalam emel susulan, atau hubungi kami dengan nombor rujukan."
  );

  if (content.faqs.length > 0) {
    push(
      "## Soalan lazim",
      "",
      ...content.faqs.flatMap((faq) => [
        `### ${faq.question}`,
        "",
        faq.answer,
        "",
      ])
    );
  }

  push(
    "## Liputan negeri",
    "",
    "Pembayaran fidyah boleh dibuat dari semua negeri di Malaysia:",
    "",
    NEGERI.join(", ") + "."
  );

  if (articles.length > 0) {
    push(
      "## Artikel panduan",
      "",
      ...articles.map(
        (a) =>
          `- [${a.title}](${SITE_URL}/blog/${a.slug})` +
          (a.excerpt ? ` — ${a.excerpt}` : "")
      )
    );
  }

  push(
    "## Hubungi",
    "",
    `- **Telefon:** ${ORG.phoneDisplay}`,
    ...(content.whatsapp_number
      ? [
          `- **WhatsApp:** https://wa.me/${content.whatsapp_number.replace(
            /\D/g,
            ""
          )}`,
        ]
      : []),
    `- **Alamat:** ${ORG_ADDRESS_LINE}`,
    `- **Halaman hubungi:** ${SITE_URL}/hubungi`,
    `- **Tentang kami:** ${SITE_URL}/tentang-kami`,
    `- **Dasar privasi:** ${SITE_URL}/privasi`
  );

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
