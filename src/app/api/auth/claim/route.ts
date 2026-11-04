import { headers } from "next/headers";
import { registerSchema } from "@/domain/auth";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { fail, json, service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const id = await viewerId();
    if (!id) return json({ error: "profile" }, 401);
    const body = registerSchema.parse(await request.json());
    const ip = (await headers()).get("x-forwarded-for") ?? "unknown";
    if (!checkRateLimit(`${ip}:claim:${body.username.toLowerCase()}`)) {
      return json({ error: "rate_limit" }, 429);
    }
    const result = await service().claim(id, body);
    if ("error" in result) {
      if (result.error === "username_taken" || result.error === "account_exists") {
        return json(result, 409);
      }
      if (result.error === "demo") return json(result, 403);
      if (result.error === "password_weak") return json(result, 400);
      return json(result, 404);
    }
    return json({ account: { username: result.username } }, 201);
  } catch (error) {
    return fail(error);
  }
}
