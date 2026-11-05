"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type SessionShape = {
  profile: { id: string } | null;
  event: { id: string; name: string } | null;
  needsSetup: boolean;
};

type Explanation = {
  source: "model";
  summary: string;
  opener: string;
  confidence: string;
};

/**
 * Scan landing: anonymous visitors see a join CTA. Signed-in viewers at a
 * registered event get the existing affinity + connection actions — no matching
 * logic is duplicated here.
 */
export function ScanConnect({ slug, profileId }: { slug: string; profileId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionShape | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/session")
      .then((response) => response.json())
      .then((body) => {
        if (!cancelled) setSession(body as SessionShape);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!session?.profile || session.needsSetup || !session.event) {
    return (
      <div className="w-full rounded-[20px] border border-border bg-surface p-4 text-left shadow-[var(--shadow-raise)]">
        <p className="font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
          Scanned an IntroMesh card
        </p>
        <p className="mt-2 text-sm leading-relaxed">
          This is a public networking card. Join the event and turn on presence to see why you two should talk.
        </p>
        <Button type="button" className="mt-3 h-11 min-[720px]:h-9" onClick={() => router.push("/")}>
          Join IntroMesh
        </Button>
      </div>
    );
  }

  async function explain() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/affinity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId, eventId: session?.event?.id }),
      });
      const body = (await response.json()) as { explanation?: Explanation; error?: string };
      if (!response.ok || !body.explanation) {
        setError(
          body.error === "presence"
            ? "Both of you need presence on at the same event."
            : body.error === "match"
              ? "Not enough shared signals yet."
              : body.error === "config"
                ? "Explanation unavailable — Meta API not configured."
                : "Explanation unavailable. Try again.",
        );
        return;
      }
      setExplanation(body.explanation);
    } catch {
      setError("Could not load the explanation.");
    } finally {
      setPending(false);
    }
  }

  async function request() {
    if (!explanation) return;
    await fetch("/api/connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId, intro: explanation.opener, introSource: explanation.source, eventId: session?.event?.id }),
    });
    setRequested(true);
  }

  return (
    <div className="w-full rounded-[20px] border border-border bg-surface p-4 text-left shadow-[var(--shadow-raise)]">
      <p className="font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        Why you two should talk · {slug}
      </p>
      {!explanation ? (
        <Button type="button" className="mt-3 h-11 min-[720px]:h-9" disabled={pending} onClick={() => void explain()}>
          {pending ? "Preparing…" : "Show match explanation"}
        </Button>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-[0.9375rem] leading-normal">{explanation.summary}</p>
          <p className="font-heading text-lg leading-snug italic">{explanation.opener}</p>
          {requested ? (
            <p role="status" className="text-sm text-muted-foreground">
              Request sent. Acceptance is still up to them.
            </p>
          ) : (
            <Button type="button" className="mt-1 h-11 w-fit min-[720px]:h-9" onClick={() => void request()}>
              Request intro
            </Button>
          )}
        </div>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
