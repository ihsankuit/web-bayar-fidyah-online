"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  createAdminUser,
  type AdminFormState,
} from "@/app/admin/(panel)/pentadbir/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
      Tambah Pentadbir
    </Button>
  );
}

export function AddAdminForm() {
  const [state, action] = useActionState<AdminFormState, FormData>(
    createAdminUser,
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      toast.success("Pentadbir baharu berjaya ditambah.");
      formRef.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tambah Pentadbir Baharu</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={action} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Emel</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Kata laluan sementara</Label>
              <Input
                id="password"
                name="password"
                type="text"
                minLength={6}
                required
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Kongsi emel & kata laluan ini secara selamat dengan pentadbir
            baharu. Mereka log masuk terus dengan kata laluan ini dan boleh
            menukarnya kemudian.
          </p>
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
