import { z } from "zod";
import type { SharedCard } from "@/domain/profile";

export const vcardSchema = z.object({
  slug: z.string().min(1).max(120),
});

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

/** vCard 3.0 with only public card fields. No email, phone, or internal ids. */
export function buildVCard(card: SharedCard, origin: string): string {
  const url = `${origin}/p/${card.slug}`;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeText(card.displayName)}`,
    `TITLE:${escapeText(card.role || "IntroMesh")}`,
    `URL:${escapeText(url)}`,
    `NOTE:${escapeText(`IntroMesh networking card. ${card.displayName} · ${card.role || "Participant"}. View: ${url}`)}`,
    "END:VCARD",
  ];
  return `${lines.join("\r\n")}\r\n`;
}

export function vcardFileName(slug: string): string {
  return `${slug.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || "intromesh"}.vcf`;
}
