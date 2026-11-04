import { headers } from "next/headers";
import { loginSchema } from "@/domain/auth";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { fail, json, service } from "@/lib/http";
import { writeProfileId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const ip = (await headers()).get("x-forwarded-for") ?? "unknown";
    if (!checkRateLimit(`${ip}:login:${body.username.toLowerCase()}`)) {
      return json({ error: "rate_limit" }, 429);
    }
    const result = await service().login(body);
    if ("error" in result) return json(result, 401);
    await writeProfileId(result.userId);
    return json({ account: { username: result.username } });
  } catch (error) {
    return fail(error);
  }
}
