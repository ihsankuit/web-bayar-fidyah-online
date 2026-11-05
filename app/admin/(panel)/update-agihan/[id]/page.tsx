import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AgihanUpdateEditor } from "@/components/admin/agihan-update-editor";
import { createClient } from "@/lib/supabase/server";
import type { AgihanUpdate } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function EditAgihanUpdatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("agihan_updates")
    .select("*")
    .eq("id", id)
    .maybeSingle<AgihanUpdate>();

  if (!data) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/update-agihan"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke senarai
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Edit Update Agihan
        </h1>
      </div>

      <AgihanUpdateEditor item={data} />
    </div>
  );
}
