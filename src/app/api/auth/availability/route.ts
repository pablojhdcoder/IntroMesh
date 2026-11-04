import { fail, json, service } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const username = new URL(request.url).searchParams.get("username") ?? "";
    const result = await service().checkUsername(username);
    return json(result);
  } catch (error) {
    return fail(error);
  }
}
