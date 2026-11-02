"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Link2, Nfc } from "lucide-react";
import { Button } from "@/components/ui/button";

function profileLink(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/p/")) return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

const action = "h-11 w-full min-[720px]:h-9 min-[720px]:w-auto";
const ghostAction = "h-11 min-[720px]:h-9";

export function nfcSupported(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && "NDEFReader" in window;
}

export function ShareTools({ slug, name }: { slug: string; name: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    // NFC availability only exists on the client; set after mount to match the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client capability probe
    setSupported(nfcSupported());
  }, []);
  const url = typeof window === "undefined" ? `/p/${slug}` : `${window.location.origin}/p/${slug}`;

  async function track(method: "link" | "qr" | "nfc") {
    await fetch("/api/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method }),
    });
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    await track("link");
    setMessage("Link copied.");
  }

  async function writeTag() {
    const Reader = window.NDEFReader;
    if (!Reader) {
      setMessage("This browser does not expose Web NFC. The QR and link still work.");
      return;
    }
    try {
      const reader = new Reader();
      await reader.write({ records: [{ recordType: "url", data: url }] });
      await track("nfc");
      setMessage("Tag written with the public URL.");
    } catch {
      setMessage("NFC cancelled, denied, or unavailable. Use the QR code.");
    }
  }

  async function readTag() {
    const Reader = window.NDEFReader;
    if (!Reader) return;
    try {
      const reader = new Reader();
      await reader.scan();
      reader.onreading = (event) => {
        const record = event.message.records[0];
        if (!record?.data) return;
        const text = new TextDecoder().decode(record.data);
        const target = profileLink(text);
        if (!target) {
          setMessage("That tag does not point to an IntroMesh profile on this site.");
          return;
        }
        window.location.assign(target);
      };
      setMessage("Hold a compatible tag close. This does not detect other phones.");
    } catch {
      setMessage("Could not read. You need a gesture, a secure context, and compatible hardware.");
    }
  }

  const copied = message === "Link copied.";

  return (
    <div className="flex flex-col gap-5">
      <p className="font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">Share your card</p>
      <div className="w-fit rounded-[20px] border border-border bg-surface p-4 shadow-[var(--shadow-raise)]">
        <Image
          src={`/api/profiles/${slug}/qr`}
          alt={`QR code for ${name}'s profile`}
          width={144}
          height={144}
          unoptimized
          className="h-36 w-36 rounded-[8px] invert dark:invert-0"
        />
      </div>
      <div className="flex flex-col gap-2 min-[720px]:flex-row min-[720px]:flex-wrap min-[720px]:items-center">
        <Button type="button" className={action} onClick={() => void copyLink()}>
          {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
          Copy link
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" className={ghostAction} disabled={!supported} onClick={() => void writeTag()}>
            <Nfc aria-hidden="true" />
            Write NFC
          </Button>
          <Button type="button" variant="ghost" className={ghostAction} disabled={!supported} onClick={() => void readTag()}>
            <Nfc aria-hidden="true" />
            Read NFC
          </Button>
        </div>
      </div>
      <p className="max-w-[48ch] text-sm leading-relaxed text-muted-foreground">
        {supported ? "NFC writes a tag. It does not pair phones." : "NFC unavailable. Use link or QR."}
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
