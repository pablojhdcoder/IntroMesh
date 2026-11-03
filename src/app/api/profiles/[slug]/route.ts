import { json, service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const profile = await service().profileBySlug(slug, await viewerId());
  if (!profile) return json({ error: "missing" }, 404);
  return json({ profile });
}
