import { z } from "zod";
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

const patchSchema = z.object({
  avatarUrl: z.union([z.string().url(), z.literal("")]).nullable().optional(),
  profileVisibility: z.enum(["public", "private"]).optional(),
});

export async function PATCH(request: Request) {
  const id = await viewerId();
  if (!id) return json({ error: "profile" }, 401);
  try {
    const parsed = patchSchema.parse(await request.json());
    const result = await service().updateProfileSettings(id, parsed);
    if ("error" in result) return json(result, 404);
    return json({ profile: result });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  const id = await viewerId();
  if (!id) return json({ error: "profile" }, 401);
  try {
    const body = await request.json();
    const input = profileInputSchema.parse(body.profile ?? body);
    const presentation = await contextualizeProfile(input);
    return json({ presentation });
  } catch (error) {
    return fail(error);
  }
}
