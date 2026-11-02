"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "cn";
import type { PublicProfile, SharedCard } from "@/domain/profile";
import { Button } from "@/components/ui/button";
import { Crossfade } from "@/components/ui/crossfade";
import { OnboardingFlow, type OnboardingDraft } from "@/components/onboarding/onboarding-flow";
import { FIELD_SELF_ID, SignalField, type FieldPerson } from "@/components/signal/signal-field";
import { ShareTools } from "@/components/share/share-tools";
import { ThemeSwitch } from "@/components/theme-switch";
import { ArrowUpRight, Check, ChevronRight, EyeOff, RefreshCw } from "lucide-react";

type Explanation = {
  source: "model" | "demo";
  summary: string;
  opener: string;
  citedGoals: string[];
  citedInterests: string[];
  citedSkills: string[];
  complement: string[];
  confidence: "low" | "medium" | "high";
};

type Connection = {
  id: string;
  status: "pending" | "accepted" | "declined";
  toId: string;
  fromId: string;
  intro: string | null;
  other: SharedCard;
};

type Session = {
  profile: PublicProfile | null;
  needsSetup: boolean;
  identityConfirmed?: boolean;
  canCreateEvent?: boolean;
  draft?: OnboardingDraft | null;
  metaConfigured: boolean;
  event: { id: string; name: string; demo: boolean } | null;
};

type Presence = "invisible" | "active" | "seeking";

const PRESENCE_OPTIONS: { id: Presence; label: string; enabled: boolean; seeking: boolean }[] = [
  { id: "invisible", label: "Invisible", enabled: false, seeking: false },
  { id: "active", label: "Active", enabled: true, seeking: false },
  { id: "seeking", label: "Seeking", enabled: true, seeking: true },
];

const meta = "font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase";
const actionSize = "h-11 w-full min-[720px]:h-9 min-[720px]:w-auto";
const focusRing = "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

function evidenceOf(recommendation: NonNullable<FieldPerson["recommendation"]>) {
  return [
    ...recommendation.shared.interests.map((value) => ({ kind: "Shared interest", value })),
    ...recommendation.shared.skills.map((value) => ({ kind: "Shared skill", value })),
    ...recommendation.complement.map((value) => ({ kind: "Complements", value })),
  ].slice(0, 3);
}

function reasonOf(person: FieldPerson) {
  return person.recommendation?.shared.interests[0] ?? person.recommendation?.shared.skills[0] ?? person.recommendation?.complement[0] ?? "shared goal";
}

export function SignalApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [presence, setPresence] = useState<Presence>("invisible");
  const [people, setPeople] = useState<FieldPerson[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explainPending, setExplainPending] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sessionResponse = await fetch("/api/session");
    const nextSession = (await sessionResponse.json()) as Session;
    setSession(nextSession);
    if (!nextSession.profile || nextSession.needsSetup || !nextSession.event) return;
    const [discoveryResponse, connectionsResponse] = await Promise.all([
      fetch(`/api/discovery?eventId=${nextSession.event.id}`),
      fetch(`/api/connections?eventId=${nextSession.event.id}`),
    ]);
    if (!discoveryResponse.ok) {
      setLoadError("Could not load the event.");
      return;
    }
    const discovery = await discoveryResponse.json();
    setPresence(discovery.presence);
    setPeople(discovery.people);
    setConnections((await connectionsResponse.json()).connections ?? []);
    setLoadError(null);
  }, []);

  useEffect(() => {
    // Session lives on the server; the first paint must read it.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load; setState runs after fetch
    void load();
  }, [load]);

  useEffect(() => {
    if (!session?.event || presence === "invisible") return;
    const timer = window.setInterval(() => {
      void fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: session.event?.id, enabled: true, seeking: presence === "seeking" }),
      });
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [presence, session?.event]);

  async function changePresence(enabled: boolean, seeking: boolean) {
    if (!session?.event) return;
    await fetch("/api/presence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: session.event.id, enabled, seeking }),
    });
    await load();
  }

  async function openPerson(id: string | null, regenerate = false) {
    if (!id || id === FIELD_SELF_ID) {
      setSelectedId(id);
      setExplanation(null);
      setExplainError(null);
      setExplainPending(false);
      return;
    }
    setSelectedId(id);
    setExplainPending(true);
    setExplainError(null);
    const response = await fetch("/api/affinity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId: id, regenerate, eventId: session?.event?.id }),
    });
    const body = await response.json();
    setExplainPending(false);
    if (!response.ok) {
      setExplanation(null);
      setExplainError(
        body.error === "match"
          ? "Not enough evidence."
          : body.error === "presence"
            ? "Turn on presence."
            : "Meta returned no explanation.",
      );
      return;
    }
    setExplanation(body.explanation as Explanation);
  }

  async function requestIntro() {
    if (!selectedId || !explanation) return;
    await fetch("/api/connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId: selectedId, intro: explanation.opener, introSource: explanation.source }),
    });
    await load();
  }

  async function resolve(connection: Connection, action: "accept" | "decline") {
    await fetch("/api/connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        connectionId: connection.id,
        action,
        simulateDemo: connection.other.demo,
      }),
    });
    await load();
  }

  if (!session) {
    return (
      <div className="mx-auto flex w-full max-w-6xl items-start justify-between gap-4 px-4 py-6 sm:px-8">
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2.5 font-heading text-[2rem] leading-none tracking-[-0.02em]">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full border border-border bg-signal" />
            IntroMesh
          </p>
          <div aria-hidden="true" className="flex animate-pulse flex-col gap-2.5">
            <div className="h-2.5 w-48 rounded-full bg-surface-raised" />
            <div className="h-2.5 w-32 rounded-full bg-surface-raised" />
            <div className="h-2.5 w-40 rounded-full bg-surface-raised" />
          </div>
          <p role="status" className="sr-only">
            Loading session.
          </p>
        </div>
        <ThemeSwitch />
      </div>
    );
  }
  if (session.needsSetup || !session.profile) {
    return (
      <OnboardingFlow
        metaConfigured={session.metaConfigured}
        identityConfirmed={session.identityConfirmed ?? false}
        canCreateEvent={session.canCreateEvent ?? false}
        draft={session.draft ?? null}
        onSaved={() => void load()}
      />
    );
  }

  const visible = presence !== "invisible";
  const selfSelected = selectedId === FIELD_SELF_ID;
  const selected = people.find((person) => person.id === selectedId) ?? null;
  const detail = visible && selected && selected.recommendation ? { person: selected, recommendation: selected.recommendation } : null;
  const relation = connections.find((item) => item.other.id === selectedId && item.status !== "declined");
  const recommendations = people.filter((person) => person.recommendation);
  const others = detail ? recommendations.filter((person) => person.id !== detail.person.id) : recommendations;

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-8 min-[720px]:h-svh min-[720px]:gap-6 min-[720px]:overflow-hidden">
      <header className="relative flex shrink-0 flex-col gap-3 min-[720px]:flex-row min-[720px]:items-start min-[720px]:justify-between">
        <div className="flex flex-col gap-2 pr-16 min-[720px]:pr-0">
          <h1 className="flex items-center gap-2.5 font-heading text-[2.25rem] leading-none tracking-[-0.02em]">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full border border-border bg-signal" />
            IntroMesh
          </h1>
          <p className="flex max-w-[36ch] flex-wrap items-center gap-2">
            <span className={meta}>{session.event?.name}</span>
            {session.event?.demo ? (
              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
                Demo
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col gap-2 min-[720px]:items-end">
          <ThemeSwitch className="absolute top-0 right-0 min-[720px]:static" />
          <div className="flex items-center justify-between gap-4 min-[720px]:justify-end">
            <div role="group" aria-label="Presence" className="flex items-center rounded-full border border-border bg-surface p-1 shadow-sm">
              {PRESENCE_OPTIONS.map((option) => {
                const active = presence === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => void changePresence(option.enabled, option.seeking)}
                    className={cn(
                      "inline-flex h-11 items-center gap-1.5 rounded-full px-3.5 text-sm transition-[background-color,color,box-shadow] duration-200 ease-out select-none min-[720px]:h-9",
                      focusRing,
                      active ? "bg-foreground text-background shadow" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {active ? (
                      <span
                        aria-hidden="true"
                        className={cn("size-1.5 shrink-0 rounded-full", option.id === "invisible" ? "bg-current opacity-50" : "bg-signal")}
                      />
                    ) : null}
                    {option.label}
                  </button>
                );
              })}
            </div>
            <Link
              href="/intelligence"
              className={cn(
                "inline-flex h-11 items-center gap-1 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground min-[720px]:h-9",
                focusRing,
              )}
            >
              Intelligence
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      {!session.metaConfigured ? (
        <p className={cn(meta, "flex shrink-0 items-center gap-2")}>
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--signal-strong)] dark:bg-signal" />
          Demo · declared fields, not Meta
        </p>
      ) : null}
      {loadError ? (
        <p role="alert" className="shrink-0 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 items-stretch gap-6 min-[720px]:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)] min-[720px]:gap-8">
        <SignalField
          people={visible ? people : []}
          selectedId={selectedId}
          onSelect={(id) => void openPerson(id === selectedId ? null : id)}
        />

        <section className="flex min-h-0 flex-col gap-6 min-[720px]:overflow-y-auto">
          <Crossfade
            id={!visible ? "invisible" : selfSelected ? "self" : detail ? `person:${detail.person.id}` : "list"}
            className="flex flex-col gap-6"
          >
          {!visible ? (
            <div className="flex flex-col items-start gap-3 pt-2">
              <span className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground">
                <EyeOff aria-hidden="true" className="size-4" />
              </span>
              <p className="max-w-[40ch] text-sm text-muted-foreground">Invisible. Turn on presence to see the room.</p>
            </div>
          ) : null}

          {selfSelected && session.profile ? (
            <article className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h2 className="font-heading text-[2rem] leading-[0.95] tracking-[-0.03em] min-[720px]:text-[2.5rem]">{session.profile.displayName}</h2>
                <p className={meta}>{session.profile.role} · You</p>
              </div>
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Interests</dt>
                <dd>{session.profile.interests.join(", ")}</dd>
                <dt className="text-muted-foreground">Skills</dt>
                <dd>{session.profile.skills.join(", ")}</dd>
                <dt className="text-muted-foreground">Looking for</dt>
                <dd>{session.profile.seeking}</dd>
              </dl>
            </article>
          ) : null}

          {detail ? (
            <article className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h2 className="font-heading text-[2rem] leading-[0.95] tracking-[-0.03em] text-balance min-[720px]:text-[2.5rem]">{detail.person.displayName}</h2>
                <p className={cn(meta, "flex flex-wrap items-center gap-2")}>
                  <span>
                    {detail.person.role}
                    {detail.recommendation.shared.goals[0] ? ` · ${detail.recommendation.shared.goals[0]}` : ""}
                  </span>
                  {detail.person.demo ? (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem]">Demo</span>
                  ) : null}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <dl className="flex flex-col divide-y divide-border text-sm">
                  {evidenceOf(detail.recommendation).map((item) => (
                    <div key={`${item.kind}-${item.value}`} className="grid grid-cols-[max-content_1fr] gap-x-4 py-2">
                      <dt className="text-muted-foreground">{item.kind}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
                <p>
                  <span className="inline-flex rounded-full border border-border px-2 py-0.5 font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
                    {detail.recommendation.confidence === "low"
                      ? "Low confidence · not a fact"
                      : detail.recommendation.confidence === "medium"
                        ? "Medium confidence"
                        : "High confidence"}
                  </span>
                </p>
              </div>

              <Crossfade
                id={explainPending ? "pending" : explainError ? "error" : explanation ? "ready" : "idle"}
                initial
                className="flex flex-col gap-3"
              >
                {explainPending ? (
                  <div className="flex flex-col gap-2">
                    <div aria-hidden="true" className="flex animate-pulse flex-col gap-2.5">
                      <div className="h-2.5 w-3/4 rounded-full bg-surface-raised" />
                      <div className="h-2.5 w-full rounded-full bg-surface-raised" />
                      <div className="h-2.5 w-1/2 rounded-full bg-surface-raised" />
                    </div>
                    <p role="status" className="sr-only">
                      Preparing explanation.
                    </p>
                  </div>
                ) : null}
                {explainError ? (
                  <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {explainError}
                  </p>
                ) : null}
                {explanation ? (
                  <div className="flex flex-col gap-3 border-l-2 border-[var(--signal-strong)] pl-4 dark:border-signal">
                    <p className="max-w-[52ch] text-[0.9375rem] leading-normal">{explanation.summary}</p>
                    <p className="max-w-[52ch] font-heading text-lg leading-snug italic">{explanation.opener}</p>
                    <p>
                      <span className="inline-flex rounded-full border border-border px-2 py-0.5 font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
                        {explanation.source === "model" ? "Meta AI" : "Demo"}
                      </span>
                    </p>
                  </div>
                ) : null}
              </Crossfade>

              <div className="flex flex-col gap-3">
                {relation?.status === "pending" ? (
                  <p>
                    <span className="inline-flex rounded-full border border-border px-2 py-0.5 font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
                      Request pending
                    </span>
                  </p>
                ) : null}
                {relation?.status === "accepted" ? (
                  <p className="flex max-w-[52ch] items-start gap-2 text-sm">
                    <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--signal-strong)] dark:text-signal" />
                    <span>Connection accepted{relation.intro ? `. ${relation.intro}` : "."}</span>
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 min-[720px]:flex-row min-[720px]:items-center">
                  {!relation ? (
                    <Button type="button" className={actionSize} disabled={!explanation} onClick={() => void requestIntro()}>
                      Request connection
                    </Button>
                  ) : null}
                  {relation?.status === "pending" && relation.other.demo ? (
                    <Button type="button" className={actionSize} onClick={() => void resolve(relation, "accept")}>
                      Simulate accept
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" className={actionSize} onClick={() => void openPerson(detail.person.id, true)}>
                    <RefreshCw aria-hidden="true" className="size-4" />
                    Regenerate
                  </Button>
                </div>
              </div>

              {relation?.status === "accepted" && session.profile ? (
                <Crossfade id="share" initial className="flex flex-col">
                  <ShareTools slug={session.profile.slug} name={session.profile.displayName} />
                </Crossfade>
              ) : null}
            </article>
          ) : null}

          {visible ? (
            <div className={cn("flex flex-col gap-3", (detail || selfSelected) && "min-[720px]:hidden")}>
              <h2 className={meta}>{detail ? "More signals" : "Recommendations"}</h2>
              {others.length === 0 ? (
                <p className="max-w-[40ch] text-sm text-muted-foreground">
                  {detail ? "No more signals." : "Nobody visible yet."}
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {others.map((person) => (
                    <li key={person.id}>
                      <button
                        type="button"
                        onClick={() => void openPerson(person.id)}
                        className={cn(
                          "group -mx-2 flex min-h-11 w-full items-center justify-between gap-4 rounded-md px-2 py-3 text-left text-sm transition-colors hover:bg-surface-raised",
                          focusRing,
                        )}
                      >
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-medium underline-offset-4 group-hover:underline">
                            {person.displayName}
                            {person.demo ? <span className="font-normal text-muted-foreground"> · demo</span> : null}
                          </span>
                          <span className="truncate text-muted-foreground">{reasonOf(person)}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <ChevronRight
                            aria-hidden="true"
                            className="size-4 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                          />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
          </Crossfade>
        </section>
      </div>
    </div>
  );
}
