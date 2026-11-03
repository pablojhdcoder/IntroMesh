import { redirect } from "next/navigation";
import { SignalApp } from "@/components/signal/signal-app";
import { service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

type MembershipLike = { eventId?: string; status?: string; event?: { id: string } };

export default async function EventRoomPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const id = await viewerId();
  if (!id) redirect("/");
  const session = await service().session(id);
  if (!session.profile) redirect("/");

  const withMemberships = session as typeof session & { memberships?: MembershipLike[] };
  let joined = false;
  if (Array.isArray(withMemberships.memberships)) {
    joined = withMemberships.memberships.some(
      (item) => (item.eventId ?? item.event?.id) === eventId && (item.status ?? "joined") === "joined",
    );
  } else {
    const mine = (await service().listMyEvents(id)) as unknown as MembershipLike[];
    joined = (Array.isArray(mine) ? mine : []).some(
      (item) => (item.eventId ?? item.event?.id) === eventId && (item.status ?? "joined") === "joined",
    );
  }
  if (!joined) redirect("/events");

  return (
    <main className="min-h-full">
      <SignalApp eventId={eventId} />
    </main>
  );
}
