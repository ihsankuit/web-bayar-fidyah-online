import { notFound } from "next/navigation";
import { PostEditor } from "@/components/admin/post-editor";
import { createClient } from "@/lib/supabase/server";
import type { BlogPost } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const post = data as BlogPost | null;
  if (!post) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Artikel</h1>
        <p className="text-muted-foreground">{post.title}</p>
      </div>
      <PostEditor post={post} />
    </div>
  );
}
