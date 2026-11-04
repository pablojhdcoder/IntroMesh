"use client";

import { useState } from "react";
import { Check, Link2, Contact } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileQr } from "@/components/share/profile-qr";

const action = "h-11 w-full min-[720px]:h-9 min-[720px]:w-auto";
const ghostAction = "h-11 min-[720px]:h-9";

export function ShareTools({ slug, name }: { slug: string; name: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const url = typeof window === "undefined" ? `/u/${slug}` : `${window.location.origin}/u/${slug}`;

  async function track(method: "link" | "qr" | "vcard") {
    try {
      await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method }),
      });
    } catch {
      // Analytics is best-effort; never block the share action.
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied.");
    } catch {
      setMessage("Could not copy the link. Copy it from the address bar instead.");
    }
    await track("link");
  }

  async function downloadVCard() {
    const anchor = document.createElement("a");
    anchor.href = `/api/profiles/${slug}/vcard`;
    anchor.download = `${slug}.vcf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    await track("vcard");
  }

  const copied = message === "Link copied.";

  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">Share your card</h2>
      <div className="w-fit rounded-[20px] border border-border bg-surface p-4 shadow-[var(--shadow-raise)]">
        <ProfileQr slug={slug} name={name} size={152} />
      </div>
      <div className="flex flex-col gap-2 min-[720px]:flex-row min-[720px]:flex-wrap min-[720px]:items-center">
        <Button type="button" className={action} onClick={() => void copyLink()}>
          {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
          Copy link
        </Button>
        <Button type="button" variant="ghost" className={ghostAction} onClick={() => void downloadVCard()}>
          <Contact aria-hidden="true" />
          Save contact (.vcf)
        </Button>
      </div>
      <p className="max-w-[48ch] text-sm leading-relaxed text-muted-foreground">
        The QR and link open your public card — anyone with them can view it.
      </p>
      {message ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
          {copied ? <Check aria-hidden="true" className="size-4 shrink-0 text-foreground" /> : null}
          {message}
        </p>
      ) : null}
    </div>
  );
}
