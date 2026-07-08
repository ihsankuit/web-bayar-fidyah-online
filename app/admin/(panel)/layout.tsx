import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/admin/sidebar";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  } catch {
    // Supabase not configured — send to login rather than crashing.
    redirect("/admin/login");
  }

  if (!user) redirect("/admin/login");

  return (
    <div className="flex min-h-screen bg-muted/20">
      <Sidebar email={user.email ?? "Pentadbir"} />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
