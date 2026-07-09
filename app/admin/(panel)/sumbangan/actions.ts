"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { markDonationPaid } from "@/lib/donations";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
}

export async function confirmDonationPaid(formData: FormData) {
  await requireUser();
  const id = formData.get("id") as string;
  if (!id) return;

  await markDonationPaid(id);
  revalidatePath("/admin/sumbangan");
  revalidatePath("/admin");
}
