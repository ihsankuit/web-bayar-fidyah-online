/**
 * Fidyah domain logic.
 *
 * Fidyah is a compensation (in the form of staple food, typically one cupak
 * / secupak of rice per missed day, or its monetary value) paid by those who
 * are unable to fast during Ramadan and cannot make up (qada') the fast.
 *
 * In Malaysia the monetary rate is set per state (negeri) based on the current
 * price of a cupak of rice. Where a person delays their qada' past the
 * following Ramadan, the fidyah compounds for each year of delay.
 *
 * The default rate below (RM2.00 / day) reflects the common baseline rate used
 * by several state religious authorities. Administrators can override the
 * effective rate from the admin dashboard (see `site_settings.fidyah_rate_sen`).
 */

export const DEFAULT_FIDYAH_RATE_SEN = 200; // RM2.00 per day

export type FidyahCategoryId =
  | "uzur_tua"
  | "sakit_kronik"
  | "hamil_menyusu"
  | "lewat_qada"
  | "meninggal_dunia"
  | "lain";

export interface FidyahCategory {
  id: FidyahCategoryId;
  title: string;
  description: string;
}

/** The recognised categories of people who owe fidyah. */
export const FIDYAH_CATEGORIES: FidyahCategory[] = [
  {
    id: "uzur_tua",
    title: "Warga emas / uzur",
    description:
      "Golongan tua yang tidak mampu berpuasa dan tiada harapan untuk mengqada' puasa.",
  },
  {
    id: "sakit_kronik",
    title: "Sakit berpanjangan",
    description:
      "Pesakit kronik yang disahkan doktor tidak berupaya berpuasa dan tiada harapan sembuh.",
  },
  {
    id: "hamil_menyusu",
    title: "Ibu hamil & menyusu",
    description:
      "Wanita yang meninggalkan puasa kerana bimbangkan keselamatan diri atau anak.",
  },
  {
    id: "lewat_qada",
    title: "Lewat qada' puasa",
    description:
      "Mereka yang melewatkan qada' puasa sehingga masuk Ramadan berikutnya tanpa keuzuran.",
  },
  {
    id: "meninggal_dunia",
    title: "Bagi pihak si mati",
    description:
      "Waris membayar bagi pihak si mati yang meninggalkan puasa dan sempat untuk mengqada'.",
  },
  {
    id: "lain",
    title: "Lain-lain",
    description: "Keadaan lain yang mewajibkan pembayaran fidyah.",
  },
];

export function getCategory(id: string): FidyahCategory | undefined {
  return FIDYAH_CATEGORIES.find((c) => c.id === id);
}

export interface FidyahCalculationInput {
  /** Number of missed fasting days. */
  days: number;
  /**
   * Compounding multiplier for delayed qada'. 1 = paid on time. A value of 2
   * means one Ramadan was missed before qada', and so on. Kept simple: the
   * final amount is days * rate * multiplier.
   */
  multiplier?: number;
  /** Rate per day, in sen. Defaults to the baseline rate. */
  rateSen?: number;
}

export interface FidyahCalculationResult {
  days: number;
  multiplier: number;
  rateSen: number;
  totalSen: number;
}

export function calculateFidyah({
  days,
  multiplier = 1,
  rateSen = DEFAULT_FIDYAH_RATE_SEN,
}: FidyahCalculationInput): FidyahCalculationResult {
  const safeDays = Math.max(0, Math.floor(days || 0));
  const safeMultiplier = Math.max(1, Math.floor(multiplier || 1));
  const totalSen = safeDays * safeMultiplier * rateSen;
  return {
    days: safeDays,
    multiplier: safeMultiplier,
    rateSen,
    totalSen,
  };
}

/** Malaysian states, for the payer form. */
export const NEGERI = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Perak",
  "Perlis",
  "Pulau Pinang",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
  "W.P. Kuala Lumpur",
  "W.P. Labuan",
  "W.P. Putrajaya",
] as const;

export type Negeri = (typeof NEGERI)[number];
