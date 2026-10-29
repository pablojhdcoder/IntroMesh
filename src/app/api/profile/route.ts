import { presentationSchema, profileInputSchema } from "@/domain/profile";
import { fail, json, service, viewerId } from "@/lib/http";
import { contextualizeProfile } from "@/lib/meta/explain";
import { writeProfileId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = profileInputSchema.parse(body.profile ?? body);
    const presentation = body.presentation ? presentationSchema.parse(body.presentation) : null;
    const saved = await service().saveProfile(await viewerId(), input, presentation);
    await writeProfileId(saved.id);
    return json({ profile: saved });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const input = profileInputSchema.parse(body.profile ?? body);
    const presentation = await contextualizeProfile(input);
    return json({ presentation });
  } catch (error) {
    return fail(error);
  }
}
