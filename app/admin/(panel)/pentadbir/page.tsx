import { Trash2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";
import { AddAdminForm } from "@/components/admin/add-admin-form";
import { deleteAdminUser } from "./actions";

export const dynamic = "force-dynamic";

export default async function PentadbirPage() {
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data } = await admin.auth.admin.listUsers();
  const users = data?.users ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pentadbir</h1>
        <p className="text-muted-foreground">
          Urus akaun pentadbir yang mempunyai akses ke dashboard ini.
        </p>
      </div>

      <AddAdminForm />

      <Card>
        <CardHeader>
          <CardTitle>{users.length} pentadbir</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emel</TableHead>
                <TableHead>Dicipta</TableHead>
                <TableHead>Log masuk terakhir</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                const isLast = users.length <= 1;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      {u.email}
                      {isSelf && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (anda)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(u.created_at)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.last_sign_in_at ? formatDate(u.last_sign_in_at) : "—"}
                    </TableCell>
                    <TableCell>
                      {!isSelf && !isLast && (
                        <form action={deleteAdminUser}>
                          <input type="hidden" name="id" value={u.id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 /> Padam
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
