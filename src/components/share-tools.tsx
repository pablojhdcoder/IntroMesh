"use client";

import { useState } from "react";
import Image from "next/image";
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

export function nfcSupported(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && "NDEFReader" in window;
}

export function ShareTools({ slug, name }: { slug: string; name: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const supported = typeof window === "undefined" ? false : nfcSupported();
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
    setMessage("Enlace copiado.");
  }

  async function writeTag() {
    const Reader = window.NDEFReader;
    if (!Reader) {
      setMessage("Este navegador no expone Web NFC. El QR y el enlace siguen disponibles.");
      return;
    }
    try {
      const reader = new Reader();
      await reader.write({ records: [{ recordType: "url", data: url }] });
      await track("nfc");
      setMessage("Etiqueta escrita con la URL pública.");
    } catch {
      setMessage("NFC cancelado, sin permiso o sin hardware. Usa el QR.");
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
          setMessage("La etiqueta no apunta a un perfil de IntroMesh en este sitio.");
          return;
        }
        window.location.assign(target);
      };
      setMessage("Acerca una etiqueta compatible. Esto no detecta otros teléfonos.");
    } catch {
      setMessage("No se pudo leer. Hace falta un gesto, contexto seguro y hardware compatible.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Image
        src={`/api/profiles/${slug}/qr`}
        alt={`Código QR del perfil de ${name}`}
        width={144}
        height={144}
        unoptimized
        className="h-36 w-36 bg-surface"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void copyLink()}>
          Copiar enlace
        </Button>
        <Button type="button" variant="outline" onClick={() => void track("qr")}>
          QR listo
        </Button>
        <Button type="button" variant="ghost" disabled={!supported} onClick={() => void writeTag()}>
          Escribir NFC
        </Button>
        <Button type="button" variant="ghost" disabled={!supported} onClick={() => void readTag()}>
          Leer NFC
        </Button>
      </div>
      <p className="max-w-[48ch] text-sm text-muted-foreground">
        {supported
          ? "Web NFC solo actúa sobre una etiqueta, con un gesto tuyo. No empareja dos teléfonos."
          : "NFC no está disponible aquí. Chrome en Android y un contexto seguro son el caso compatible. El enlace y el QR no dependen de eso."}
      </p>
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}
