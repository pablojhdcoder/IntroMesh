import { headers } from "next/headers";
import { registerSchema } from "@/domain/auth";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { fail, json, service } from "@/lib/http";
import { writeProfileId } from "@/lib/session";

export const dynamic = "force-dynamic";

function rateKey(username: string): string {
  return `register:${username.toLowerCase()}`;
}

export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await request.json());
    const ip = (await headers()).get("x-forwarded-for") ?? "unknown";
    if (!checkRateLimit(`${ip}:${rateKey(body.username)}`)) {
      return json({ error: "rate_limit" }, 429);
    }
    const result = await service().register(body);
    if ("error" in result) {
      if (result.error === "username_taken") return json(result, 409);
      return json(result, 400);
    }
    await writeProfileId(result.userId);
    return json({ account: { username: result.username } }, 201);
  } catch (error) {
    return fail(error);
  }
}
