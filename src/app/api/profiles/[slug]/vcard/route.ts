import { json, service, viewerId } from "@/lib/http";
import { buildVCard, vcardFileName } from "@/lib/vcard";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const profile = await service().profileBySlug(slug, await viewerId());
  if (!profile) return json({ error: "missing" }, 404);
  const origin = new URL(request.url).origin;
  const body = buildVCard(profile, origin);
  return new Response(body, {
    headers: {
      "content-type": "text/vcard; charset=utf-8",
      "content-disposition": `attachment; filename="${vcardFileName(profile.slug)}"`,
      "cache-control": "no-store",
    },
  });
}
