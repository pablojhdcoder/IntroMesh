import { json, service, viewerId } from "@/lib/http";
import { buildSaveUrl, googleWalletStatus } from "@/lib/wallet/google";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = await viewerId();
  if (!id) return json({ error: "profile" }, 401);
  const slug = new URL(request.url).searchParams.get("slug")?.trim();
  if (!slug) return json({ error: "invalid" }, 400);
  const status = googleWalletStatus();
  if (!status.configured) return json({ error: status.reason }, 503);
  const database = await service().profileBySlug(slug);
  if (!database) return json({ error: "missing" }, 404);
  try {
    const origin = new URL(request.url).origin;
    return json({ url: buildSaveUrl(database, origin) });
  } catch {
    return json({ error: "google-wallet-not-configured" }, 503);
  }
}
