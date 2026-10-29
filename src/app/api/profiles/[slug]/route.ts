import { json, service } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const profile = await service().profileBySlug(slug);
  if (!profile) return json({ error: "missing" }, 404);
  return json({ profile });
}
