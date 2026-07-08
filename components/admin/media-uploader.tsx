"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { uploadMedia, type MediaState } from "@/app/admin/(panel)/media/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Upload />}
      Muat Naik
    </Button>
  );
}

export function MediaUploader() {
  const [state, action] = useActionState<MediaState, FormData>(uploadMedia, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      toast.success("Fail berjaya dimuat naik.");
      formRef.current?.reset();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3">
      <Input
        type="file"
        name="file"
        required
        accept="image/*"
        className="max-w-xs cursor-pointer"
      />
      <SubmitButton />
    </form>
  );
}
