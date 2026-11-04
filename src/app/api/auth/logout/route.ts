import { json } from "@/lib/http";
import { clearProfileId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearProfileId();
  return json({ ok: true });
}
