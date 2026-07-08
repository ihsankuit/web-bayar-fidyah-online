import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import type { BlogPost } from "@/lib/database.types";
import { formatDate } from "@/lib/utils";
import { deletePost } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminBlogPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .order("created_at", { ascending: false });
  const posts = (data as BlogPost[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Blog</h1>
          <p className="text-muted-foreground">Urus artikel dan penerbitan.</p>
        </div>
        <Button asChild>
          <Link href="/admin/blog/new">
            <Plus /> Artikel Baru
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 sm:p-2">
          {posts.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Belum ada artikel. Cipta artikel pertama anda.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tajuk</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dikemaskini</TableHead>
                  <TableHead className="text-right">Tindakan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <div className="font-medium">{post.title}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        /blog/{post.slug}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          post.status === "published" ? "success" : "secondary"
                        }
                      >
                        {post.status === "published" ? "Diterbitkan" : "Draf"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(post.updated_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/blog/${post.id}`}>
                            <Pencil /> Edit
                          </Link>
                        </Button>
                        <form action={deletePost}>
                          <input type="hidden" name="id" value={post.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
