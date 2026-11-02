import type { SharedCard } from "@/domain/profile";

export type AppleWalletStatus =
  | { configured: true }
  | { configured: false; reason: string };

/**
 * Apple Wallet (.pkpass) needs a paid Apple Developer Program membership
 * (Pass Type ID + Pass certificate). Without those env vars the route
 * returns 503 and the UI hides the button — same pattern as MODEL_API_KEY.
 */
export function appleWalletStatus(): AppleWalletStatus {
  if (!process.env.APPLE_PASS_TYPE_ID?.trim()) return { configured: false, reason: "apple-pass-type-missing" };
  if (!process.env.APPLE_TEAM_ID?.trim()) return { configured: false, reason: "apple-team-missing" };
  if (!process.env.APPLE_PASS_CERT_PEM?.trim()) return { configured: false, reason: "apple-cert-missing" };
  if (!process.env.APPLE_PASS_KEY_PEM?.trim()) return { configured: false, reason: "apple-key-missing" };
  if (!process.env.APPLE_WWDR_PEM?.trim()) return { configured: false, reason: "apple-wwdr-missing" };
  return { configured: true };
}

/** Static pass.json payload. No webServiceURL: passes are static snapshots (no live updates in MVP). */
export function buildPassJson(card: SharedCard, origin: string) {
  const profileUrl = `${origin}/p/${card.slug}`;
  return {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID ?? "pass.intromesh.card",
    serialNumber: `intromesh-${card.slug}`,
    teamIdentifier: process.env.APPLE_TEAM_ID ?? "",
    organizationName: "IntroMesh",
    description: `IntroMesh networking card for ${card.displayName}`,
    generic: {
      primaryFields: [{ key: "name", label: "Name", value: card.displayName }],
      secondaryFields: [{ key: "role", label: "Role", value: card.role || "Participant" }],
      auxiliaryFields: [
        { key: "interests", label: "Interests", value: card.interests.slice(0, 3).join(", ") || "—" },
        { key: "skills", label: "Skills", value: card.skills.slice(0, 3).join(", ") || "—" },
      ],
      backFields: [
        { key: "profile", label: "Profile", value: profileUrl },
        { key: "manage", label: "Manage", value: `Open ${profileUrl} to rotate or revoke this card.` },
        { key: "privacy", label: "Privacy", value: "Public link. Anyone with this QR can view your card." },
      ],
    },
    barcodes: [{ format: "PKBarcodeFormatQR", message: profileUrl, messageEncoding: "iso-8859-1" }],
    backgroundColor: "rgb(20, 22, 12)",
    foregroundColor: "rgb(255, 255, 255)",
  };
}

export function unconfigured(): Response {
  return Response.json({ error: "apple-wallet-not-configured" }, { status: 503, headers: { "cache-control": "no-store" } });
}
