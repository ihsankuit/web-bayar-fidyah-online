"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteDonationAction } from "@/app/admin/(panel)/sumbangan/actions";

export function DeleteDonationButton({
  id,
  reference,
}: {
  id: string;
  reference: string;
}) {
  return (
    <form
      action={deleteDonationAction}
      onSubmit={(e) => {
        if (
          !confirm(
            `Padam rekod sumbangan ${reference}? Tindakan ini tidak boleh dibatalkan.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        size="sm"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        title="Padam rekod sumbangan"
      >
        <Trash2 />
      </Button>
    </form>
  );
}
