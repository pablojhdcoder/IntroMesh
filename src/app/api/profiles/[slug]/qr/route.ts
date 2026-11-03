import QRCode from "qrcode";
import { service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const profile = await service().profileBySlug(slug, await viewerId());
  if (!profile) return new Response("Not found", { status: 404 });
  const origin = new URL(request.url).origin;
  const svg = await QRCode.toString(`${origin}/u/${profile.slug}`, {
    type: "svg",
    margin: 1,
    color: { dark: "#ffffff", light: "#00000000" },
  });
  return new Response(svg, {
    headers: { "content-type": "image/svg+xml", "cache-control": "no-store" },
  });
}
