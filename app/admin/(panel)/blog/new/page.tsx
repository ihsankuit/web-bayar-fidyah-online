import { PostEditor } from "@/components/admin/post-editor";

export default function NewPostPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Artikel Baru</h1>
        <p className="text-muted-foreground">
          Cipta artikel blog baharu dalam format Markdown.
        </p>
      </div>
      <PostEditor />
    </div>
  );
}
