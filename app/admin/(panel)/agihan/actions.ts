"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMYR, slugify } from "@/lib/utils";
import { getCategory } from "@/lib/fidyah";
import { logActivity } from "@/lib/activity-log";
import { parseContacts } from "@/lib/contacts";
import type {
  FidyahDistributionRecipient,
  FidyahDistributionRecipientSource,
} from "@/lib/database.types";
import {
  getMurpatiSettings,
  isMurpatiSessionConnected,
  normalizeMalaysianPhone,
  sendMurpatiMedia,
  sendMurpatiText,
} from "@/lib/murpati";

const BUCKET = "media";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return { supabase, email: user.email ?? "unknown" };
}

interface Recipient {
  name: string;
  phone: string;
  /** Total amount (sen) across all matching donations, for {{jumlah}}. */
  amountSen: number;
  /** Total days × multiplier across all matching donations, for {{hari}}. */
  days: number;
  /** Distinct category ids across all matching donations, for {{kategori}}. */
  categories: string[];
  /** For {{negeri}} — the first non-null negeri found among their donations. */
  negeri: string | null;
  /** Imported contacts carry no donation figures — see applyTemplateVariables. */
  source: FidyahDistributionRecipientSource;
}

interface RecipientResult extends Recipient {
  status: "sent" | "failed";
  error: string | null;
}

/**
 * Substitutes variable tags with values resolved for this recipient:
 * {{nama}}, {{jumlah}}, {{hari}}, {{kategori}}, {{negeri}}.
 *
 * An imported contact has no donation behind it, so the donation-derived tags
 * render as "-" rather than a misleading "RM 0.00" / "0 hari".
 */
function applyTemplateVariables(message: string, recipient: Recipient): string {
  const imported = recipient.source === "import";
  const categoryLabel = imported
    ? "-"
    : recipient.categories
        .map((id) => getCategory(id)?.title ?? id)
        .join(" & ") || "-";

  return message
    .replaceAll("{{nama}}", recipient.name || "-")
    .replaceAll("{{jumlah}}", imported ? "-" : formatMYR(recipient.amountSen))
    .replaceAll("{{hari}}", imported ? "-" : String(recipient.days))
    .replaceAll("{{kategori}}", categoryLabel)
    .replaceAll("{{negeri}}", recipient.negeri ?? "-");
}

/**
 * Sends one message (text or media, depending on whether an image is set) to
 * a recipient. `message` is the raw template — variable tags are substituted
 * with this recipient's own values before sending.
 */
async function sendToRecipient(
  settings: Awaited<ReturnType<typeof getMurpatiSettings>>,
  recipient: Recipient,
  message: string,
  imageUrl: string | null
): Promise<RecipientResult> {
  const personalized = applyTemplateVariables(message, recipient);
  const result = imageUrl
    ? await sendMurpatiMedia(settings, recipient.phone, imageUrl, personalized)
    : await sendMurpatiText(settings, recipient.phone, personalized);

  return {
    ...recipient,
    status: result.ok ? "sent" : "failed",
    error: result.ok ? null : result.error ?? "Ralat tidak diketahui",
  };
}

interface DonationRow {
  payer_name: string;
  payer_phone: string | null;
  negeri: string | null;
  amount_sen: number;
  days: number;
  multiplier: number;
  category: string;
}

/**
 * Paid donors within [dateFrom, dateTo] (inclusive), aggregated by phone
 * number — a donor with several donations in range gets one recipient entry
 * with amount/days summed and categories collected across all of them.
 */
async function resolveRecipients(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dateFrom: string,
  dateTo: string
): Promise<Recipient[]> {
  const { data } = await supabase
    .from("donations")
    .select("payer_name, payer_phone, negeri, amount_sen, days, multiplier, category")
    .eq("status", "paid")
    .not("payer_phone", "is", null)
    .gte("paid_at", `${dateFrom}T00:00:00.000Z`)
    .lte("paid_at", `${dateTo}T23:59:59.999Z`);

  const byPhone = new Map<string, Recipient>();
  for (const row of (data as DonationRow[]) ?? []) {
    const phone = normalizeMalaysianPhone(row.payer_phone ?? "");
    if (!phone) continue;

    const days = (row.days ?? 0) * (row.multiplier ?? 1);
    const existing = byPhone.get(phone);
    if (existing) {
      existing.amountSen += row.amount_sen ?? 0;
      existing.days += days;
      if (row.category && !existing.categories.includes(row.category)) {
        existing.categories.push(row.category);
      }
      if (!existing.negeri && row.negeri) existing.negeri = row.negeri;
    } else {
      byPhone.set(phone, {
        name: row.payer_name,
        phone,
        amountSen: row.amount_sen ?? 0,
        days,
        categories: row.category ? [row.category] : [],
        negeri: row.negeri ?? null,
        source: "donation",
      });
    }
  }
  return Array.from(byPhone.values());
}

/**
 * Full recipient list for a blast: paid donors in the date range (when one is
 * given) plus any imported contacts, deduped by phone. Donation records win
 * on a clash so the variable tags keep their real figures.
 */
async function buildRecipientList(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dateFrom: string,
  dateTo: string,
  importedRaw: string
): Promise<{ recipients: Recipient[]; skipped: number[]; duplicates: number }> {
  const fromDonations =
    dateFrom && dateTo
      ? await resolveRecipients(supabase, dateFrom, dateTo)
      : [];

  const parsed = parseContacts(importedRaw);
  const byPhone = new Map<string, Recipient>();

  for (const r of fromDonations) byPhone.set(r.phone, r);

  let duplicates = parsed.duplicates;
  for (const contact of parsed.contacts) {
    if (byPhone.has(contact.phone)) {
      duplicates++;
      continue;
    }
    byPhone.set(contact.phone, {
      name: contact.name,
      phone: contact.phone,
      amountSen: 0,
      days: 0,
      categories: [],
      negeri: null,
      source: "import",
    });
  }

  return {
    recipients: Array.from(byPhone.values()),
    skipped: parsed.skipped,
    duplicates,
  };
}

/** Reads the pasted textarea and any uploaded CSV into one blob of lines. */
async function collectImportedRaw(formData: FormData): Promise<string> {
  const pasted = ((formData.get("contacts_text") as string) || "").trim();
  const file = formData.get("contacts_file") as File | null;

  let fromFile = "";
  if (file && file.size > 0) {
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("Saiz fail kontak melebihi had 2MB.");
    }
    fromFile = await file.text();
  }

  return [pasted, fromFile].filter(Boolean).join("\n");
}

export interface PreviewState {
  error?: string;
  checked?: boolean;
  count?: number;
  names?: string[];
  fromDonations?: number;
  fromImport?: number;
  skipped?: number[];
  duplicates?: number;
}

/**
 * Validates the recipient selection. Either a date range or an imported
 * contact list (or both) is enough — a blast to an imported list alone is a
 * legitimate use.
 */
function validateSelection(
  dateFrom: string,
  dateTo: string,
  importedRaw: string
): string | null {
  if (!dateFrom && !dateTo && !importedRaw) {
    return "Sila pilih julat tarikh atau import senarai kontak.";
  }
  if ((dateFrom && !dateTo) || (!dateFrom && dateTo)) {
    return "Sila lengkapkan kedua-dua tarikh, atau kosongkan kedua-duanya.";
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return "Tarikh 'dari' mesti sebelum atau sama dengan tarikh 'hingga'.";
  }
  return null;
}

/** Resolves and previews recipients, without sending anything. */
export async function previewRecipients(
  _prev: PreviewState,
  formData: FormData
): Promise<PreviewState> {
  const { supabase } = await requireUser();
  const dateFrom = (formData.get("date_from") as string) || "";
  const dateTo = (formData.get("date_to") as string) || "";

  let importedRaw: string;
  try {
    importedRaw = await collectImportedRaw(formData);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Fail tidak sah." };
  }

  const invalid = validateSelection(dateFrom, dateTo, importedRaw);
  if (invalid) return { error: invalid };

  const { recipients, skipped, duplicates } = await buildRecipientList(
    supabase,
    dateFrom,
    dateTo,
    importedRaw
  );

  return {
    checked: true,
    count: recipients.length,
    names: recipients.slice(0, 12).map((r) => r.name || r.phone),
    fromDonations: recipients.filter((r) => r.source === "donation").length,
    fromImport: recipients.filter((r) => r.source === "import").length,
    skipped,
    duplicates,
  };
}

export interface TestState {
  error?: string;
  ok?: boolean;
  message?: string;
}

/** Sample values so a test send shows exactly how the tags will render. */
const TEST_RECIPIENT: Omit<Recipient, "phone"> = {
  name: "Ahmad bin Ali",
  amountSen: 1400,
  days: 7,
  categories: ["uzur_tua"],
  negeri: "Selangor",
  source: "donation",
};

/**
 * Sends the composed message to one number so the admin can see it in
 * WhatsApp before blasting. Variable tags are filled with sample values, and
 * nothing is recorded against the distribution history.
 */
export async function sendTestBlast(
  _prev: TestState,
  formData: FormData
): Promise<TestState> {
  await requireUser();

  const rawPhone = ((formData.get("test_phone") as string) || "").trim();
  const message = ((formData.get("message") as string) || "").trim();
  const file = formData.get("image") as File | null;

  const phone = normalizeMalaysianPhone(rawPhone);
  if (!phone) return { error: "No. telefon ujian tidak sah." };
  if (!message) return { error: "Sila masukkan makluman agihan dahulu." };

  const settings = await getMurpatiSettings();
  if (!settings.apiKey || !settings.sessionId) {
    return {
      error:
        "WhatsApp (Murpati) belum disediakan. Sila isi API Key & Session ID di Integrasi.",
    };
  }
  if (!(await isMurpatiSessionConnected(settings))) {
    return {
      error:
        "Peranti WhatsApp Murpati tidak disambung. Sila semak status peranti di murpati.com/devices.",
    };
  }

  // The image is only uploaded on a real send; a test goes out as text so it
  // never leaves a stray file in storage.
  const note = file && file.size > 0 ? " (gambar tidak disertakan dalam ujian)" : "";
  const body =
    "[UJIAN] " +
    applyTemplateVariables(message, { ...TEST_RECIPIENT, phone });

  const result = await sendMurpatiText(settings, phone, body);
  if (!result.ok) return { error: `Ujian gagal dihantar — ${result.error}` };

  await logActivity("agihan.test", { phone });

  return {
    ok: true,
    message: `Mesej ujian dihantar ke ${rawPhone}${note}.`,
  };
}

export interface SendState {
  error?: string;
  ok?: boolean;
  sent?: number;
  failed?: number;
  total?: number;
}

/**
 * Sends a fidyah distribution update (text + optional image) via WhatsApp to
 * every paid donor within the given date range, then records the send in
 * `fidyah_distributions` for the history list and the activity log.
 */
export async function sendAgihanUpdate(
  _prev: SendState,
  formData: FormData
): Promise<SendState> {
  const { supabase, email } = await requireUser();

  const dateFrom = (formData.get("date_from") as string) || "";
  const dateTo = (formData.get("date_to") as string) || "";
  const message = ((formData.get("message") as string) || "").trim();
  const file = formData.get("image") as File | null;

  let importedRaw: string;
  try {
    importedRaw = await collectImportedRaw(formData);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Fail tidak sah." };
  }

  const invalid = validateSelection(dateFrom, dateTo, importedRaw);
  if (invalid) return { error: invalid };
  if (!message) return { error: "Sila masukkan makluman agihan." };
  if (file && file.size > 10 * 1024 * 1024)
    return { error: "Saiz gambar melebihi had 10MB." };

  const settings = await getMurpatiSettings();
  if (!settings.apiKey || !settings.sessionId) {
    return {
      error:
        "WhatsApp (Murpati) belum disediakan. Sila isi API Key & Session ID di Integrasi.",
    };
  }

  const connected = await isMurpatiSessionConnected(settings);
  if (!connected) {
    return {
      error:
        "Peranti WhatsApp Murpati tidak disambung. Sila semak status peranti di murpati.com/devices.",
    };
  }

  const { recipients } = await buildRecipientList(
    supabase,
    dateFrom,
    dateTo,
    importedRaw
  );
  if (recipients.length === 0) {
    return {
      error:
        "Tiada penerima dijumpai — julat tarikh ini tiada pembayar dengan no. telefon, dan senarai import kosong.",
    };
  }

  let imageUrl: string | null = null;
  if (file && file.size > 0) {
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "agihan";
    const path = `agihan/${Date.now()}-${base}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });
    if (uploadError) return { error: uploadError.message };

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);
    imageUrl = publicUrl;
  }

  const results: RecipientResult[] = [];
  for (const recipient of recipients) {
    results.push(await sendToRecipient(settings, recipient, message, imageUrl));
  }
  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.length - sent;

  const { data: distribution, error: insertError } = await supabase
    .from("fidyah_distributions")
    .insert({
      message,
      image_url: imageUrl,
      date_from: dateFrom || null,
      date_to: dateTo || null,
      recipient_count: recipients.length,
      sent_count: sent,
      failed_count: failed,
      created_by: email,
    })
    .select("id")
    .single();

  if (insertError) return { error: insertError.message };

  await supabase.from("fidyah_distribution_recipients").insert(
    results.map((r) => ({
      distribution_id: distribution.id,
      name: r.name,
      phone: r.phone,
      status: r.status,
      error: r.error,
      amount_sen: r.amountSen,
      days: r.days,
      category: r.categories.join(",") || null,
      negeri: r.negeri,
      source: r.source,
    }))
  );

  await logActivity("agihan.send", {
    date_from: dateFrom || "-",
    date_to: dateTo || "-",
    recipient_count: recipients.length,
    sent,
    failed,
  });

  revalidatePath("/admin/agihan");

  return { ok: true, sent, failed, total: recipients.length };
}

/** Re-sends the message to every recipient of a past distribution whose last attempt failed. */
export async function retryFailedRecipients(formData: FormData) {
  const { supabase } = await requireUser();
  const distributionId = formData.get("distribution_id") as string;
  if (!distributionId) return;

  const { data: distribution } = await supabase
    .from("fidyah_distributions")
    .select("*")
    .eq("id", distributionId)
    .maybeSingle();
  if (!distribution) return;

  const { data: failedRows } = await supabase
    .from("fidyah_distribution_recipients")
    .select("*")
    .eq("distribution_id", distributionId)
    .eq("status", "failed");
  const failedRecipients = (failedRows as FidyahDistributionRecipient[]) ?? [];
  if (failedRecipients.length === 0) return;

  const settings = await getMurpatiSettings();
  if (!settings.apiKey || !settings.sessionId) return;

  const connected = await isMurpatiSessionConnected(settings);
  if (!connected) return;

  let retried = 0;
  for (const recipient of failedRecipients) {
    const result = await sendToRecipient(
      settings,
      {
        name: recipient.name,
        phone: recipient.phone,
        amountSen: recipient.amount_sen,
        days: recipient.days,
        categories: recipient.category ? recipient.category.split(",") : [],
        negeri: recipient.negeri,
        source: recipient.source ?? "donation",
      },
      distribution.message,
      distribution.image_url
    );
    await supabase
      .from("fidyah_distribution_recipients")
      .update({ status: result.status, error: result.error })
      .eq("id", recipient.id);
    if (result.status === "sent") retried++;
  }

  await supabase
    .from("fidyah_distributions")
    .update({
      sent_count: distribution.sent_count + retried,
      failed_count: distribution.failed_count - retried,
    })
    .eq("id", distributionId);

  await logActivity("agihan.retry", {
    distribution_id: distributionId,
    retried,
    still_failed: failedRecipients.length - retried,
  });

  revalidatePath("/admin/agihan");
  revalidatePath(`/admin/agihan/${distributionId}`);
}

export interface TemplateState {
  error?: string;
  ok?: boolean;
  message?: string;
}

/** Saves the current message (as typed, including any {{nama}} tags) as a reusable template. */
export async function saveTemplate(
  _prev: TemplateState,
  formData: FormData
): Promise<TemplateState> {
  const { supabase } = await requireUser();
  const name = ((formData.get("template_name") as string) || "").trim();
  const message = ((formData.get("message") as string) || "").trim();

  if (!name) return { error: "Sila masukkan nama templat." };
  if (!message) return { error: "Tiada makluman untuk disimpan sebagai templat." };

  const { error } = await supabase
    .from("agihan_templates")
    .insert({ name, message });
  if (error) return { error: error.message };

  revalidatePath("/admin/agihan");
  return { ok: true, message: "Templat disimpan." };
}

/** Deletes a saved template. Called directly from the client, not via a <form>. */
export async function deleteTemplate(id: string): Promise<void> {
  const { supabase } = await requireUser();
  if (!id) return;
  await supabase.from("agihan_templates").delete().eq("id", id);
  revalidatePath("/admin/agihan");
}
