import { redirect } from "next/navigation";
import { SignalApp } from "@/components/signal/signal-app";
import { service, viewerId } from "@/lib/http";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ code?: string; event?: string }> }) {
  const params = await searchParams;
  const id = await viewerId();
  if (id) {
    const session = await service().session(id);
    if (session.profile && session.identityConfirmed) {
      const invite = params.code ?? params.event;
      redirect(invite ? `/events?code=${encodeURIComponent(invite)}` : "/events");
    }
  }
  return (
    <main className="min-h-full">
      <SignalApp entry />
    </main>
  );
}
