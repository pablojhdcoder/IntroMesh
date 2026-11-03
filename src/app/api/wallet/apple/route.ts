import { json, service, viewerId } from "@/lib/http";
import { appleWalletStatus, buildPassJson } from "@/lib/wallet/apple";

export const dynamic = "force-dynamic";

/**
 * Apple Wallet MVP gate. Full .pkpass (manifest + CMS signature) needs
 * passkit-generator plus valid Apple certificates; until then this route
 * exposes the validated pass.json so setup can be verified, and 503s
 * when env is missing. The UI hides the button on 503.
 */
export async function GET(request: Request) {
  const id = await viewerId();
  if (!id) return json({ error: "profile" }, 401);
  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  if (!slug) return json({ error: "invalid" }, 400);
  const status = appleWalletStatus();
  if (!status.configured) return json({ error: status.reason }, 503);
  const profile = await service().profileBySlug(slug, id);
  if (!profile) return json({ error: "missing" }, 404);
  const origin = new URL(request.url).origin;
  return json({ pass: buildPassJson(profile, origin), note: "pkpass-signing-pending-cert" });
}
