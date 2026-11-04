"use client";

import { Check, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileQr } from "@/components/share/profile-qr";
import { useCopyLink, CopyAnnouncer } from "@/components/share/use-copy-link";

const action = "h-11 w-full min-[720px]:h-9 min-[720px]:w-auto";

export function ShareTools({ slug, name }: { slug: string; name: string }) {
  const { copyLink, copied, failed } = useCopyLink(slug);

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">Share your card</h2>
      <div className="w-fit rounded-[20px] border border-border bg-surface p-4 shadow-[var(--shadow-raise)]">
        <ProfileQr slug={slug} name={name} size={152} />
      </div>
      <div className="flex flex-col gap-2 min-[720px]:flex-row min-[720px]:flex-wrap min-[720px]:items-center">
        <Button type="button" className={action} onClick={() => void copyLink()}>
          {copied ? <Check aria-hidden="true" /> : failed ? <X aria-hidden="true" /> : <Link2 aria-hidden="true" />}
          {copied ? "Copied" : failed ? "Couldn't copy" : "Copy link"}
        </Button>
        <CopyAnnouncer copied={copied} failed={failed} />
      </div>
      <p className="max-w-[48ch] text-sm leading-relaxed text-muted-foreground">
        The QR and link open your public card — anyone with them can view it.
      </p>
    </div>
  );
}
