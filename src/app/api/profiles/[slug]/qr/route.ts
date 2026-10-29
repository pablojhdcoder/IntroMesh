import QRCode from "qrcode";
import { service } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const profile = await service().profileBySlug(slug);
  if (!profile) return new Response("Not found", { status: 404 });
  const origin = new URL(request.url).origin;
  const svg = await QRCode.toString(`${origin}/p/${profile.slug}`, {
    type: "svg",
    margin: 1,
    color: { dark: "#f4f1ea", light: "#00000000" },
  });
  return new Response(svg, {
    headers: { "content-type": "image/svg+xml", "cache-control": "no-store" },
  });
}
