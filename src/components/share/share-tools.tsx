"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Link2, Nfc, Wallet, Contact } from "lucide-react";
import { Button } from "@/components/ui/button";

function profileLink(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/u/")) return null;
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
  const url = typeof window === "undefined" ? `/u/${slug}` : `${window.location.origin}/u/${slug}`;

  async function track(method: "link" | "qr" | "nfc" | "wallet" | "vcard") {
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

  async function downloadVCard() {
    const anchor = document.createElement("a");
    anchor.href = `/api/profiles/${slug}/vcard`;
    anchor.download = `${slug}.vcf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    await track("vcard");
  }

  async function addToGoogleWallet() {
    try {
      const response = await fetch(`/api/wallet/google?slug=${encodeURIComponent(slug)}`);
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) {
        setMessage(
          body.error === "google-wallet-not-configured"
            ? "Google Wallet is not configured on this server. Use link, QR, or vCard."
            : "Could not build the Google Wallet link.",
        );
        return;
      }
      await track("wallet");
      window.location.assign(body.url);
    } catch {
      setMessage("Could not build the Google Wallet link.");
    }
  }

  async function checkAppleWallet() {
    try {
      const response = await fetch(`/api/wallet/apple?slug=${encodeURIComponent(slug)}`);
      if (!response.ok) {
        setMessage("Apple Wallet needs a Pass Type ID certificate on the server. Use link, QR, or vCard.");
        return;
      }
      await track("wallet");
      setMessage("Apple pass is staged (unsigned preview). Add certificates to enable .pkpass download.");
    } catch {
      setMessage("Apple Wallet is not available yet.");
    }
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
        <Button type="button" variant="secondary" className={ghostAction} onClick={() => void addToGoogleWallet()}>
          <Wallet aria-hidden="true" />
          Add to Google Wallet
        </Button>
        <Button type="button" variant="secondary" className={ghostAction} onClick={() => void checkAppleWallet()}>
          <Wallet aria-hidden="true" />
          Apple Wallet
        </Button>
        <Button type="button" variant="ghost" className={ghostAction} onClick={() => void downloadVCard()}>
          <Contact aria-hidden="true" />
          Save contact (.vcf)
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
        {supported ? "NFC writes a tag. It does not pair phones." : "NFC unavailable. Use link or QR."} Wallet cards hold
        a public link only — anyone with the QR can view this card.
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
