"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { savePost, type BlogFormState } from "@/app/admin/(panel)/blog/actions";
import type { BlogPost } from "@/lib/database.types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Markdown } from "@/components/site/markdown";
import { slugify } from "@/lib/utils";

/** Format an ISO timestamp for a `datetime-local` input's value (local time). */
function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      Simpan
    </Button>
  );
}

export function PostEditor({ post }: { post?: BlogPost }) {
  const [state, formAction] = useActionState<BlogFormState, FormData>(
    savePost,
    {}
  );
  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(post?.slug));
  const [content, setContent] = useState(post?.content ?? "");
  const [status, setStatus] = useState(post?.status ?? "draft");

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-3">
      {post && <input type="hidden" name="id" value={post.id} />}

      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="title">Tajuk</Label>
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slugEdited) setSlug(slugify(e.target.value));
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL)</Label>
              <Input
                id="slug"
                name="slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugEdited(true);
                }}
                placeholder="apa-itu-fidyah"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="excerpt">Ringkasan</Label>
              <Textarea
                id="excerpt"
                name="excerpt"
                defaultValue={post?.excerpt ?? ""}
                placeholder="Ringkasan pendek untuk paparan senarai."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Kandungan (Markdown)</Label>
              <Tabs defaultValue="write">
                <TabsList>
                  <TabsTrigger value="write">Tulis</TabsTrigger>
                  <TabsTrigger value="preview">Pratonton</TabsTrigger>
                </TabsList>
                <TabsContent value="write">
                  <Textarea
                    id="content"
                    name="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[360px] font-mono text-sm"
                    placeholder={"## Tajuk\n\nTulis kandungan artikel di sini..."}
                  />
                </TabsContent>
                <TabsContent value="preview">
                  <div className="min-h-[360px] rounded-md border border-input p-4">
                    {content.trim() ? (
                      <Markdown>{content}</Markdown>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Tiada kandungan untuk dipratonton lagi.
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "draft" | "published")
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="draft">Draf</option>
                <option value="published">Diterbitkan</option>
              </select>
            </div>
            {status === "published" && (
              <div className="space-y-2">
                <Label htmlFor="published_at">Tarikh & Masa Terbit</Label>
                <Input
                  id="published_at"
                  name="published_at"
                  type="datetime-local"
                  defaultValue={toDatetimeLocal(post?.published_at)}
                />
                <p className="text-xs text-muted-foreground">
                  Kosongkan untuk terbit sekarang. Tetapkan masa depan untuk
                  jadualkan penerbitan.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="author">Penulis</Label>
              <Input
                id="author"
                name="author"
                defaultValue={post?.author ?? ""}
                placeholder="Admin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cover_image">URL Imej Kulit</Label>
              <Input
                id="cover_image"
                name="cover_image"
                defaultValue={post?.cover_image ?? ""}
                placeholder="https://... (guna pustaka Media)"
              />
            </div>
            <SubmitButton />
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
