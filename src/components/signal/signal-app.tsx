"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "cn";
import type { PublicProfile, SharedCard } from "@/domain/profile";
import type { GroundedExplanation } from "@/domain/ground";
import { Button } from "@/components/ui/button";
import { Crossfade } from "@/components/ui/crossfade";
import { AuthFlow } from "@/components/onboarding/auth-flow";
import { OnboardingFlow, type OnboardingDraft } from "@/components/onboarding/onboarding-flow";
import { FIELD_SELF_ID, SignalField, type FieldPerson } from "@/components/signal/signal-field";
import { ShareTools } from "@/components/share/share-tools";
import { ThemeSwitch } from "@/components/theme-switch";
import { SignalIntro } from "@/components/signal/signal-intro";
import { PersonCard } from "@/components/events/person-card";
import { ArrowUpRight, Check, Copy, Info, LogOut, RefreshCw } from "lucide-react";
import {
  clearRoomCache,
  explainErrorCopy,
  fetchJsonDeduped,
  getCachedRoom,
  normalizeDiscovery,
  resolveRoomState,
  setCachedRoom,
  type DirectoryPerson,
  type ViewerEmbeddingStatus,
} from "@/components/signal/use-room";

// Grounded model explanation only: source "model" comes from the domain type.
type Explanation = GroundedExplanation & { cached?: boolean };

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
  account: { username: string } | null;
  needsSetup: boolean;
  identityConfirmed?: boolean;
  canCreateEvent?: boolean;
  draft?: OnboardingDraft | null;
  metaConfigured: boolean;
  event: { id: string; name: string; demo: boolean } | null;
  memberships?: Array<{
    eventId: string;
    status: string;
    joinedAt?: string | null;
    event: { id: string; name: string; demo: boolean };
    memberCount?: number;
  }>;
};

const meta = "font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase";
const actionSize = "h-11 w-full min-[720px]:h-9 min-[720px]:w-auto";
const focusRing = "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

/** The @ is the visible identity: username wins, legacy names stay as-is. */
function nameOf(person: { username?: string | null; displayName: string }): string {
  return person.username ? `@${person.username}` : person.displayName;
}

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

function tagsOfRecommendation(person: FieldPerson): string[] {
  const rec = person.recommendation;
  if (!rec) return [...person.interests, ...person.skills].slice(0, 2);
  return [...rec.shared.interests, ...rec.shared.skills, ...rec.complement].slice(0, 2);
}

function tagsOfDirectory(person: DirectoryPerson): string[] {
  return [...person.interests, ...person.skills].slice(0, 2);
}

function PresenterChecklist({
  metaConfigured,
  pairCached,
  memberCount,
  acceptedCount,
  onDismiss,
}: {
  metaConfigured: boolean;
  pairCached: boolean;
  memberCount: number;
  acceptedCount: number;
  onDismiss: () => void;
}) {
  const params = useSearchParams();
  if (params.get("present") !== "1") return null;
  const rows: { label: string; ok: boolean; hint: string }[] = [
    { label: "Meta", ok: metaConfigured, hint: metaConfigured ? "configured" : "not configured" },
    { label: "Pair cache", ok: pairCached, hint: pairCached ? "cached" : "open a real match to warm cache" },
    { label: "Members", ok: memberCount > 0, hint: memberCount > 0 ? `${memberCount} registered` : "none yet" },
    { label: "Accepted", ok: acceptedCount > 0, hint: acceptedCount > 0 ? `${acceptedCount} accepted` : "none yet" },
  ];
  return (
    <section aria-label="Presenter checklist" className="flex shrink-0 flex-col gap-2 rounded-[12px] border border-border bg-surface p-4 shadow-[var(--shadow-raise)]">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-heading text-lg leading-none tracking-[-0.02em]">Presenter checklist</h2>
        <Button type="button" variant="ghost" className="h-9 w-auto px-3" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2 text-sm">
            <span className="font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">{row.label}</span>
            <span aria-hidden="true" className={row.ok ? "text-[var(--signal-vivid)] dark:text-signal" : "text-muted-foreground"}>
              {row.ok ? "✓" : "·"}
            </span>
            <span className="sr-only">{row.ok ? "ready" : "pending"}</span>
            <span className="text-xs text-muted-foreground">{row.hint}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SignalApp({ eventId: eventIdProp, entry }: { eventId?: string; entry?: boolean }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [people, setPeople] = useState<FieldPerson[]>([]);
  const [directory, setDirectory] = useState<DirectoryPerson[]>([]);
  const [viewerEmbeddingStatus, setViewerEmbeddingStatus] = useState<ViewerEmbeddingStatus>("ready");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [directoryId, setDirectoryId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explainErrorKind, setExplainErrorKind] = useState<"match" | "presence" | "meta" | null>(null);
  const [explainPending, setExplainPending] = useState(false);
  const [openerDraft, setOpenerDraft] = useState("");
  const [copiedIntro, setCopiedIntro] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [checklistDismissed, setChecklistDismissed] = useState(false);
  const [openerKey, setOpenerKey] = useState<string | null>(null);
  const [requestPending, setRequestPending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const nextOpenerKey = explanation ? `${selectedId ?? ""}:${explanation.summary}:${explanation.opener}` : null;
  useEffect(() => {
    if (nextOpenerKey !== openerKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync draft when selection/explanation changes
      setOpenerKey(nextOpenerKey);
      setOpenerDraft(explanation?.opener ?? "");
      setCopiedIntro(false);
      setCopyError(null);
    }
  }, [nextOpenerKey, openerKey, explanation]);
  useEffect(() => {
    if (!copiedIntro) return;
    const timer = window.setTimeout(() => setCopiedIntro(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedIntro]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [leavePending, setLeavePending] = useState(false);
  const [roomLoading, setRoomLoading] = useState(true);
  const roomRequest = useRef(0);
  const explainSeq = useRef(0);
  const explanationCache = useRef(new Map<string, Explanation>());
  const [showIntro, setShowIntro] = useState(false);
  const activeEventId = eventIdProp ?? session?.event?.id;
  const activeMembership = activeEventId
    ? session?.memberships?.find((item) => item.eventId === activeEventId && item.status === "joined")
    : undefined;
  const activeEvent = activeMembership?.event ?? session?.event ?? null;

  const loadRoom = useCallback(async (eventId: string, opts?: { background?: boolean }) => {
    // Reuse the cached roster instantly; a background refresh must never
    // clear the current people (no people=[] flash on mode switch).
    const cached = getCachedRoom<Connection>(eventId);
    if (cached) {
      setPeople(cached.people);
      setDirectory(cached.directory ?? []);
      setViewerEmbeddingStatus(cached.viewerEmbeddingStatus ?? "ready");
      setConnections(cached.connections);
    }
    const foreground = !opts?.background && !cached;
    if (foreground) {
      setRoomLoading(true);
      setLoadError(null);
    }
    const requestId = ++roomRequest.current;
    // Parallel pair (kept); per-key dedupe collapses concurrent callers
    // into one fetch each.
    const [discoveryResult, connectionsResult] = await Promise.all([
      fetchJsonDeduped(`discovery:${eventId}`, `/api/discovery?eventId=${eventId}`),
      fetchJsonDeduped(`connections:${eventId}`, `/api/connections?eventId=${eventId}`),
    ]);
    // Ignore stale responses: a newer load wins.
    if (roomRequest.current !== requestId) return;
    if (!discoveryResult.ok) {
      if (foreground) setRoomLoading(false);
      setLoadError("Could not load the event.");
      return;
    }
    const discovery = discoveryResult.body as {
      people?: unknown;
      directory?: unknown;
      viewerEmbeddingStatus?: unknown;
    } | null;
    const snapshot = normalizeDiscovery(discovery ?? {});
    const fetchedPeople = discoveryResult.ok ? snapshot.people : (cached?.people ?? []);
    const fetchedDirectory = discoveryResult.ok ? snapshot.directory : (cached?.directory ?? []);
    const fetchedEmbeddingStatus = discoveryResult.ok
      ? snapshot.viewerEmbeddingStatus
      : (cached?.viewerEmbeddingStatus ?? "ready");
    const connectionsBody = connectionsResult.body as { connections?: Connection[] } | null;
    const fetchedConnections = Array.isArray(connectionsBody?.connections)
      ? connectionsBody.connections
      : (cached?.connections ?? []);
    setCachedRoom<Connection>(eventId, {
      people: fetchedPeople,
      directory: fetchedDirectory,
      connections: fetchedConnections,
      viewerEmbeddingStatus: fetchedEmbeddingStatus,
      at: Date.now(),
    });
    setPeople(fetchedPeople);
    setDirectory(fetchedDirectory);
    setViewerEmbeddingStatus(fetchedEmbeddingStatus);
    setConnections(fetchedConnections);
    setLoadError(null);
    setRoomLoading(false);
  }, []);

  const load = useCallback(async () => {
    const sessionResponse = await fetch("/api/session");
    const nextSession = (await sessionResponse.json()) as Session;
    setSession(nextSession);
    if (entry && nextSession.profile && nextSession.identityConfirmed) {
      router.replace("/events");
      return;
    }
    if (!nextSession.profile) return;
    if (eventIdProp) {
      await loadRoom(eventIdProp);
      return;
    }
    if (nextSession.needsSetup || !nextSession.event) return;
    await loadRoom(nextSession.event.id);
  }, [loadRoom, entry, eventIdProp, router]);

  useEffect(() => {
    // Session lives on the server; the first paint must read it.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load; setState runs after fetch
    void load();
  }, [load]);

  const profileId = session?.profile?.id ?? null;
  useEffect(() => {
    if (!activeEventId || !profileId) return;
    try {
      const key = `intro-seen:${activeEventId}:${profileId}`;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- first-visit intro; reads localStorage once per event+profile
      if (!window.localStorage.getItem(key)) setShowIntro(true);
    } catch {
      setShowIntro(false);
    }
  }, [activeEventId, profileId]);

  function dismissIntro() {
    if (activeEventId && profileId) {
      try {
        window.localStorage.setItem(`intro-seen:${activeEventId}:${profileId}`, "1");
      } catch {
        // Storage unavailable: still dismiss for this visit.
      }
    }
    setShowIntro(false);
  }

  async function retryRoom() {
    if (!activeEventId) return;
    await loadRoom(activeEventId);
  }

  async function leaveEvent() {
    const eventId = activeEventId;
    if (!eventId || leavePending) return;
    roomRequest.current += 1;
    explainSeq.current += 1;
    setLeavePending(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/participation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "leave", eventId }),
      });
      if (!response.ok) throw new Error("leave");
      clearRoomCache();
      explanationCache.current.clear();
      setPeople([]);
      setDirectory([]);
      setConnections([]);
      setSelectedId(null);
      setDirectoryId(null);
      setExplanation(null);
      setExplainError(null);
      setExplainErrorKind(null);
      setViewerEmbeddingStatus("ready");
      if (eventIdProp) {
        router.push("/events");
        return;
      }
      await load();
    } catch {
      setLoadError("Could not leave the event. Try again.");
    } finally {
      setLeavePending(false);
    }
  }

  async function openPerson(id: string | null, regenerate = false) {
    const seq = ++explainSeq.current;
    setDirectoryId(null);
    if (!id || id === FIELD_SELF_ID) {
      setSelectedId(id);
      setExplanation(null);
      setExplainError(null);
      setExplainErrorKind(null);
      setExplainPending(false);
      return;
    }
    setSelectedId(id);
    const cacheKey = `${activeEventId ?? ""}:${id}`;
    if (!regenerate) {
      const cached = explanationCache.current.get(cacheKey);
      if (cached) {
        setExplanation(cached);
        setExplainError(null);
        setExplainErrorKind(null);
        setExplainPending(false);
        return;
      }
    } else {
      explanationCache.current.delete(cacheKey);
    }
    setExplainPending(true);
    setExplainError(null);
    setExplainErrorKind(null);
    try {
      const response = await fetch("/api/affinity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: id, regenerate, eventId: activeEventId }),
      });
      const body = (await response.json()) as { error?: unknown; explanation?: Explanation };
      if (explainSeq.current !== seq) return;
      setExplainPending(false);
      if (!response.ok) {
        setExplanation(null);
        const kind = body.error === "match" ? "match" : body.error === "presence" ? "presence" : "meta";
        setExplainErrorKind(kind);
        setExplainError(explainErrorCopy(kind));
        return;
      }
      setExplainErrorKind(null);
      setExplanation(body.explanation as Explanation);
      if (body.explanation) explanationCache.current.set(cacheKey, body.explanation as Explanation);
    } catch {
      if (explainSeq.current !== seq) return;
      setExplanation(null);
      setExplainErrorKind("meta");
      setExplainError(explainErrorCopy("meta"));
    } finally {
      if (explainSeq.current === seq) setExplainPending(false);
    }
  }

  function openDirectoryPerson(id: string | null) {
    // Directory rows open the public card only: no score, no reason,
    // no explanation fetch, no connect action.
    explainSeq.current += 1;
    setSelectedId(null);
    setExplanation(null);
    setExplainError(null);
    setExplainErrorKind(null);
    setExplainPending(false);
    setDirectoryId(id);
  }

  async function requestIntro() {
    if (!selectedId || !explanation || requestPending) return;
    const trimmed = openerDraft.trim();
    if (!trimmed) return;
    const edited = trimmed !== explanation.opener.trim();
    setRequestPending(true);
    setRequestError(null);
    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: selectedId, intro: trimmed, introSource: edited ? "user" : "model", eventId: activeEventId }),
      });
      if (!response.ok) throw new Error("request");
      setRequestError(null);
      await load();
    } catch {
      setRequestError("Could not send request. Try again.");
    } finally {
      setRequestPending(false);
    }
  }

  if (!session) {
    return (
      <div className="mx-auto flex w-full max-w-6xl items-start justify-between gap-4 px-4 py-6 sm:px-8">
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2.5 font-heading text-[2rem] leading-none tracking-[-0.02em]">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full border border-border bg-[var(--signal-vivid)] dark:bg-signal" />
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
  if (!session.profile && !session.account) {
    return <AuthFlow onAuthed={() => void load()} />;
  }
  if (!session.profile || (session.needsSetup && !eventIdProp)) {
    return (
      <OnboardingFlow
        metaConfigured={session.metaConfigured}
        identityConfirmed={session.identityConfirmed ?? false}
        canCreateEvent={session.canCreateEvent ?? false}
        draft={session.draft ?? null}
        accountUsername={session.account?.username ?? null}
        onSaved={() => void load()}
      />
    );
  }

  const selfSelected = selectedId === FIELD_SELF_ID;
  const selected = people.find((person) => person.id === selectedId) ?? null;
  const detail = selected && selected.recommendation ? { person: selected, recommendation: selected.recommendation } : null;
  const directoryPerson = !detail ? (directory.find((person) => person.id === directoryId) ?? null) : null;
  const relation = connections.find((item) => item.other.id === selectedId && item.status !== "declined");
  const recommendations = people.filter((person) => person.recommendation);
  const others = detail ? recommendations.filter((person) => person.id !== detail.person.id) : recommendations;
  const embeddingPending = viewerEmbeddingStatus === "pending";
  const roomState = resolveRoomState({ loading: roomLoading, error: loadError, count: recommendations.length });
  const emptyRoom = !roomLoading && !loadError && !embeddingPending && recommendations.length === 0 && directory.length === 0;
  const noMatchesYet = !roomLoading && !loadError && !embeddingPending && recommendations.length === 0 && directory.length > 0;
  const memberCount = recommendations.length + directory.length;
  const traceChips = explanation
    ? [
        ...explanation.citedGoals.slice(0, 2).map((value) => ({ label: `Cited · goal: ${value}`, key: `goal-${value}` })),
        ...explanation.citedInterests.slice(0, 2).map((value) => ({ label: `Cited · interest: ${value}`, key: `interest-${value}` })),
        ...explanation.citedSkills.slice(0, 2).map((value) => ({ label: `Cited · skill: ${value}`, key: `skill-${value}` })),
        ...explanation.complement.slice(0, 2).map((value) => ({ label: `Complements: ${value}`, key: `complement-${value}` })),
      ].slice(0, 6)
    : [];
  const talkPoints = explanation
    ? [...explanation.citedGoals, ...explanation.citedInterests, ...explanation.citedSkills, ...explanation.complement].slice(0, 3)
    : detail
      ? evidenceOf(detail.recommendation).map((item) => item.value).slice(0, 3)
      : [];
  const meetIntro = relation?.intro ?? explanation?.opener ?? openerDraft.trim();
  const requestDisabled = !explanation || explainPending || !!explainError || openerDraft.trim().length === 0 || requestPending;
  const pairCached = !!explanation && !explainPending;
  const acceptedCount = connections.filter((item) => item.status === "accepted").length;

  async function copyIntro(text: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyError(null);
      setCopiedIntro(true);
    } catch {
      setCopiedIntro(false);
      setCopyError("Copy failed — select the text manually.");
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-8 min-[720px]:h-svh min-[720px]:gap-6 min-[720px]:overflow-hidden">
      <header className="relative flex shrink-0 flex-col gap-3 min-[720px]:flex-row min-[720px]:items-start min-[720px]:justify-between">
        <div className="flex flex-col gap-2 pr-16 min-[720px]:pr-0">
          <h1 className="flex items-center gap-2.5 font-heading text-[2.25rem] leading-none tracking-[-0.02em]">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full border border-border bg-[var(--signal-vivid)] dark:bg-signal" />
            IntroMesh
          </h1>
          <p className="flex max-w-[36ch] flex-wrap items-center gap-2">
            <span className={meta}>{activeEvent?.name}</span>
            {activeEvent?.demo ? (
              <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
                Demo
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/events"
              className={cn("inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground min-[720px]:min-h-9", focusRing)}
            >
              Back to events
            </Link>
            {session.memberships && session.memberships.filter((item) => item.status === "joined").length > 0 ? (
              <>
                <label htmlFor="event-switcher" className="sr-only">
                  Switch event
                </label>
                <select
                  id="event-switcher"
                  aria-label="Switch event"
                  value={activeEventId ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value || value === activeEventId) return;
                    router.push(`/events/${value}`);
                  }}
                  className={cn(
                    "min-h-11 rounded-[8px] border border-border bg-surface px-3 py-2 text-base text-foreground min-[720px]:min-h-9 min-[720px]:text-sm",
                    focusRing,
                  )}
                >
                  {session.memberships
                    .filter((item) => item.status === "joined")
                    .map((item) => (
                      <option key={item.eventId} value={item.eventId}>
                        {item.event.name}
                      </option>
                    ))}
                </select>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 min-[720px]:items-end">
          <ThemeSwitch className="absolute top-0 right-0 min-[720px]:static" />
          <div className="flex items-center justify-between gap-2 min-[720px]:justify-end">
            <button
              type="button"
              onClick={() => setShowIntro(true)}
              aria-label="Replay intro"
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground min-[720px]:h-9",
                focusRing,
              )}
            >
              <Info aria-hidden="true" className="size-4" />
              Replay intro
            </button>
            <button
              type="button"
              onClick={() => void leaveEvent()}
              disabled={leavePending}
              aria-label={leavePending ? "Leaving event" : "Leave event"}
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground disabled:opacity-50 min-[720px]:h-9",
                focusRing,
              )}
            >
              <LogOut aria-hidden="true" className="size-4" />
              {leavePending ? "Leaving…" : "Leave event"}
            </button>
            <button
              type="button"
              onClick={() =>
                void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
                  clearRoomCache();
                  router.replace("/");
                  void load();
                })
              }
              aria-label="Log out"
              className={cn(
                "inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground min-[720px]:h-9",
                focusRing,
              )}
            >
              Log out
            </button>
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

      {!checklistDismissed ? (
        <Suspense fallback={null}>
          <PresenterChecklist
            metaConfigured={session.metaConfigured}
            pairCached={pairCached}
            memberCount={memberCount}
            acceptedCount={acceptedCount}
            onDismiss={() => setChecklistDismissed(true)}
          />
        </Suspense>
      ) : null}
      {loadError ? (
        <div role="alert" className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p>{loadError}</p>
          {activeEvent ? (
            <button type="button" onClick={() => void retryRoom()} className={cn("rounded-md px-2 py-1 font-medium underline underline-offset-4", focusRing)}>
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 items-stretch gap-6 min-[720px]:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)] min-[720px]:gap-8">
        {showIntro && session.profile ? (
          <div className="flex flex-col gap-6 min-[720px]:col-span-2">
            <SignalIntro
              displayName={nameOf(session.profile)}
              role={session.profile.role}
              onDone={dismissIntro}
              onSkip={dismissIntro}
            />
          </div>
        ) : (
          <>
        <SignalField
          people={people}
          selectedId={selectedId}
          loading={roomLoading}
          embeddingPending={embeddingPending}
          onSelect={(id) => void openPerson(id === selectedId ? null : id)}
        />

        <section className="flex min-h-0 flex-col gap-6 min-[720px]:overflow-y-auto" aria-label="Signals and people">
          <Crossfade
            id={selfSelected ? "self" : detail ? `person:${detail.person.id}` : directoryPerson ? `card:${directoryPerson.id}` : "list"}
            className="flex flex-col gap-6"
          >
          {selfSelected && session.profile ? (
            <article className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h2 className="font-heading text-[2rem] leading-[0.95] tracking-[-0.03em] min-[720px]:text-[2.5rem]">{nameOf(session.profile)}</h2>
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
                <h2 className="font-heading text-[2rem] leading-[0.95] tracking-[-0.03em] text-balance min-[720px]:text-[2.5rem]">{nameOf(detail.person)}</h2>
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
                  {evidenceOf(detail.recommendation).map((item, index) => (
                    <div key={`${item.kind}-${item.value}-${index}`} className="grid grid-cols-[max-content_1fr] gap-x-4 py-2">
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
                  <div role="alert" className="flex flex-col gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <p>{explainError}</p>
                    {explainErrorKind === "match" ? <p className="text-destructive/80">Pick a highlighted person.</p> : null}
                    {explainErrorKind === "meta" ? (
                      <p>
                        <button
                          type="button"
                          onClick={() => void openPerson(selectedId, true)}
                          className={cn("rounded-md px-2 py-1 font-medium underline underline-offset-4", focusRing)}
                        >
                          Try again
                        </button>
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {explanation ? (
                  <div className="flex flex-col gap-3 border-l-2 border-[var(--signal-vivid)] pl-4 dark:border-signal">
                    <p className="max-w-[52ch] text-[0.9375rem] leading-normal">{explanation.summary}</p>
                    {traceChips.length > 0 ? (
                      <ul aria-label="Evidence trace" className="flex flex-wrap gap-1.5">
                        {traceChips.map((chip, index) => (
                          <li
                            key={`${chip.key}-${index}`}
                            className="inline-flex rounded-full border border-border px-2 py-0.5 font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase"
                          >
                            {chip.label}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="opener-edit" className="font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
                        Opener
                      </label>
                      <textarea
                        id="opener-edit"
                        value={openerDraft}
                        onChange={(event) => setOpenerDraft(event.target.value)}
                        maxLength={220}
                        rows={3}
                        className={cn(
                          "w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-[0.9375rem] leading-normal text-foreground",
                          focusRing,
                        )}
                      />
                      <p className="font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase">
                        {openerDraft.length}/220
                      </p>
                    </div>
                    <p>
                      <span className="inline-flex rounded-full border border-border px-2 py-0.5 font-mono text-[0.7rem] tracking-[0.08em] text-muted-foreground uppercase">
                        Meta AI
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
                <div className="flex flex-col gap-2 min-[720px]:flex-row min-[720px]:items-center">
                  {!relation ? (
                    <Button type="button" className={actionSize} disabled={requestDisabled} onClick={() => void requestIntro()}>
                      Request connection
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" className={actionSize} onClick={() => void openPerson(detail.person.id, true)}>
                    <RefreshCw aria-hidden="true" className="size-4" />
                    Regenerate
                  </Button>
                </div>
                {requestError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {requestError}
                  </p>
                ) : null}
              </div>

              {relation?.status === "accepted" && session.profile ? (
                <Crossfade id="share" initial className="flex flex-col">
                  <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-4 shadow-[var(--shadow-raise)]">
                    <h3 className="font-heading text-xl leading-none tracking-[-0.02em]">Meet now</h3>
                    <p className="flex max-w-[52ch] items-start gap-2 text-sm">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--signal-vivid)] dark:text-signal" />
                      <span>Connection accepted{relation.intro ? `. ${relation.intro}.` : "."}</span>
                    </p>
                    {meetIntro ? (
                      <div className="flex flex-col gap-2">
                        <p className="max-w-[52ch] font-heading text-lg leading-snug italic">{meetIntro}</p>
                        <div>
                          <Button
                            type="button"
                            variant="ghost"
                            className={cn(actionSize, "w-auto")}
                            onClick={() => void copyIntro(meetIntro)}
                            aria-label={copiedIntro ? "Copied" : "Copy"}
                          >
                            {copiedIntro ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
                            {copiedIntro ? "Copied" : "Copy"}
                          </Button>
                        </div>
                        {copyError ? (
                          <p role="status" className="text-sm text-muted-foreground">
                            {copyError}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {talkPoints.length > 0 ? (
                      <ul aria-label="Talking points" className="flex flex-wrap gap-1.5">
                        {talkPoints.map((point, index) => (
                          <li
                            key={`${point}-${index}`}
                            className="inline-flex rounded-full border border-border px-2 py-0.5 font-mono text-[0.65rem] tracking-[0.08em] text-muted-foreground uppercase"
                          >
                            {point}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="max-w-[52ch] text-sm text-muted-foreground">Share your card so they can find you in the room.</p>
                    <ShareTools slug={session.profile.slug} name={nameOf(session.profile)} />
                  </div>
                </Crossfade>
              ) : null}
            </article>
          ) : null}

          {directoryPerson ? (
            <article className="flex flex-col gap-4" aria-label="Public card">
              <div className="flex flex-col gap-2">
                <h2 className="font-heading text-[2rem] leading-[0.95] tracking-[-0.03em] text-balance min-[720px]:text-[2.5rem]">
                  {nameOf(directoryPerson)}
                </h2>
                <p className={cn(meta, "flex flex-wrap items-center gap-2")}>
                  <span>{directoryPerson.role}</span>
                  {directoryPerson.demo ? (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem]">Demo</span>
                  ) : null}
                </p>
              </div>
              {directoryPerson.interests.length > 0 || directoryPerson.skills.length > 0 ? (
                <dl className="flex flex-col divide-y divide-border text-sm">
                  {directoryPerson.interests.length > 0 ? (
                    <div className="grid grid-cols-[max-content_1fr] gap-x-4 py-2">
                      <dt className="text-muted-foreground">Interests</dt>
                      <dd>{directoryPerson.interests.join(", ")}</dd>
                    </div>
                  ) : null}
                  {directoryPerson.skills.length > 0 ? (
                    <div className="grid grid-cols-[max-content_1fr] gap-x-4 py-2">
                      <dt className="text-muted-foreground">Skills</dt>
                      <dd>{directoryPerson.skills.join(", ")}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              <div className="flex flex-col gap-2 min-[720px]:flex-row min-[720px]:items-center">
                <Link
                  href={`/u/${directoryPerson.slug}`}
                  className={cn(
                    "inline-flex h-11 items-center gap-1.5 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-transform duration-200 ease-[var(--ease-out)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 min-[720px]:h-9",
                    focusRing,
                  )}
                >
                  View public card
                  <ArrowUpRight aria-hidden="true" className="size-4" />
                </Link>
                <Button type="button" variant="ghost" className={actionSize} onClick={() => openDirectoryPerson(null)}>
                  Back to signals
                </Button>
              </div>
            </article>
          ) : null}

          <div className={cn("flex flex-col gap-3", (detail || selfSelected || directoryPerson) && "min-[720px]:hidden")}>
            <h2 className={meta}>{detail ? "More signals" : "Recommendations"}</h2>
            {roomState === "loading" || embeddingPending ? (
              <div className="flex flex-col gap-2.5">
                <div aria-hidden="true" className="flex animate-pulse flex-col gap-2.5">
                  <div className="h-2.5 w-3/4 rounded-full bg-surface-raised" />
                  <div className="h-2.5 w-full rounded-full bg-surface-raised" />
                  <div className="h-2.5 w-1/2 rounded-full bg-surface-raised" />
                </div>
                <p role="status" className={embeddingPending ? "text-sm text-muted-foreground" : "sr-only"}>
                  {embeddingPending ? "Finding your people…" : "Loading the room."}
                </p>
              </div>
            ) : null}
            {!embeddingPending && roomState === "empty" && emptyRoom ? (
              <div className="flex flex-col items-start gap-3">
                <p className="max-w-[40ch] text-sm text-muted-foreground">You&apos;re the first one here. Share the event link and this room fills up as people register.</p>
                <Button type="button" className={actionSize} disabled={leavePending} onClick={() => void leaveEvent()}>
                  {leavePending ? "Leaving…" : "Join a different event"}
                </Button>
              </div>
            ) : null}
            {!embeddingPending && roomState === "empty" && noMatchesYet ? (
              <div className="flex flex-col items-start gap-3">
                <p className="max-w-[40ch] text-sm text-muted-foreground">
                  No close matches yet — everyone going is listed below.
                </p>
                <Button type="button" className={actionSize} disabled={leavePending} onClick={() => void leaveEvent()}>
                  {leavePending ? "Leaving…" : "Join a different event"}
                </Button>
              </div>
            ) : null}
            {!embeddingPending && roomState === "empty" && detail && others.length === 0 ? (
              <p className="max-w-[40ch] text-sm text-muted-foreground">No more signals.</p>
            ) : null}
            {roomState === "error" && others.length === 0 ? (
              <p className="max-w-[40ch] text-sm text-muted-foreground">Could not refresh. Try again above.</p>
            ) : null}
            {!embeddingPending && (roomState === "success" || (roomState === "error" && others.length > 0)) ? (
              <ul className="flex flex-col gap-3" aria-label="Recommended people">
                {others.map((person) => (
                  <li key={person.id}>
                    <PersonCard
                      name={nameOf(person)}
                      role={person.role}
                      slug={person.slug}
                      demo={person.demo}
                      reason={reasonOf(person)}
                      tags={tagsOfRecommendation(person)}
                      selected={selectedId === person.id}
                      onSelect={() => void openPerson(person.id)}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {!embeddingPending && directory.length > 0 ? (
            <div className={cn("flex flex-col gap-3", (detail || selfSelected || directoryPerson) && "min-[720px]:hidden")}>
              <h2 className={meta}>Everyone going</h2>
              <ul className="flex flex-col gap-3" aria-label="Everyone going">
                {directory.map((person) => (
                  <li key={person.id}>
                    <PersonCard
                      name={nameOf(person)}
                      role={person.role}
                      slug={person.slug}
                      demo={person.demo}
                      tags={tagsOfDirectory(person)}
                      selected={directoryId === person.id}
                      onSelect={() => openDirectoryPerson(person.id)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          </Crossfade>
        </section>
          </>
        )}
      </div>
    </div>
  );
}
