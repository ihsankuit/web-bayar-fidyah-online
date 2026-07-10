"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity-log";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return user;
}

export interface AdminFormState {
  error?: string;
  ok?: boolean;
}

/** Create a new admin account with a temporary password, set by an existing admin. */
export async function createAdminUser(
  _prev: AdminFormState,
  formData: FormData
): Promise<AdminFormState> {
  await requireUser();

  const email = (formData.get("email") as string)?.trim();
  const password = (formData.get("password") as string) ?? "";

  if (!email) return { error: "Emel diperlukan." };
  if (password.length < 6) {
    return { error: "Kata laluan mesti sekurang-kurangnya 6 aksara." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) return { error: error.message };

  await logActivity("admin.create", { email });
  revalidatePath("/admin/pentadbir");
  return { ok: true };
}

/** Remove an admin account. Can't remove yourself or the last remaining admin. */
export async function deleteAdminUser(formData: FormData) {
  const user = await requireUser();
  const id = formData.get("id") as string;
  if (!id || id === user.id) return;

  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers();
  const users = data?.users ?? [];
  if (users.length <= 1) return;

  const target = users.find((u) => u.id === id);
  const { error } = await admin.auth.admin.deleteUser(id);
  if (!error) {
    await logActivity("admin.delete", { email: target?.email ?? id });
  }
  revalidatePath("/admin/pentadbir");
}
