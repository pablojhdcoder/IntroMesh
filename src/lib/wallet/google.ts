import { createSign } from "node:crypto";
import type { SharedCard } from "@/domain/profile";

export type GoogleWalletStatus =
  | { configured: true; issuerId: string }
  | { configured: false; reason: string };

export function googleWalletStatus(): GoogleWalletStatus {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID?.trim();
  const email = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_WALLET_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!issuerId || !email || !key) return { configured: false, reason: "google-wallet-not-configured" };
  return { configured: true, issuerId };
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

/** Minimal RS256 JWT signer with node:crypto — no extra dependency. */
export function signJwtRs256(header: Record<string, unknown>, payload: Record<string, unknown>, privateKey: string): string {
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signer = createSign("RSA-SHA256");
  signer.update(`${encodedHeader}.${encodedPayload}`);
  signer.end();
  const signature = signer.sign(privateKey);
  return `${encodedHeader}.${encodedPayload}.${base64url(signature)}`;
}

function objectId(issuerId: string, slug: string): string {
  const safe = slug.replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 48) || "card";
  return `${issuerId}.intromesh-${safe}`;
}

/**
 * Generic pass object for one public profile. The pass carries only
 * public SharedCard fields; the QR/barcode payload is the /p/{slug} URL.
 */
export function buildGenericObject(card: SharedCard, origin: string, issuerId: string) {
  const profileUrl = `${origin}/p/${card.slug}`;
  return {
    id: objectId(issuerId, card.slug),
    classId: `${issuerId}.intromesh_generic`,
    state: "ACTIVE",
    heroImage: undefined,
    textModulesData: [
      { header: "Role", body: card.role || "Participant" },
      { header: "Interests", body: card.interests.slice(0, 3).join(", ") || "—" },
      { header: "Skills", body: card.skills.slice(0, 3).join(", ") || "—" },
    ],
    linksModuleData: {
      uris: [
        { uri: profileUrl, description: "Open IntroMesh profile" },
        { uri: `${profileUrl}?revoke=1`, description: "Manage or revoke this card" },
      ],
    },
    barcode: { type: "QR_CODE", value: profileUrl, alternateText: card.displayName },
    hexBackgroundColor: "#14160c",
    cardTitle: { defaultValue: { language: "en", value: "IntroMesh" } },
    header: { defaultValue: { language: "en", value: card.displayName } },
    subheader: { defaultValue: { language: "en", value: card.role || "Participant" } },
  };
}

/** Returns the "Add to Google Wallet" save URL, or throws when unconfigured. */
export function buildSaveUrl(card: SharedCard, origin: string): string {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID?.trim();
  const email = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL?.trim();
  const key = process.env.GOOGLE_WALLET_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!issuerId || !email || !key) throw new Error("google-wallet-not-configured");
  const genericObject = buildGenericObject(card, origin, issuerId);
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: email,
    aud: "google",
    typ: "savetowallet",
    iat: now,
    exp: now + 15 * 60,
    origins: [origin],
    payload: { genericObjects: [genericObject] },
  };
  const jwt = signJwtRs256({ alg: "RS256", typ: "JWT" }, claims, key);
  return `https://pay.google.com/gp/v/save/${jwt}`;
}
