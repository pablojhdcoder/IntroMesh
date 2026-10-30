"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "cn";
import type { PublicProfile, SharedCard } from "@/domain/profile";
import { Button } from "@/components/ui/button";
import { OnboardingFlow, type OnboardingDraft } from "@/components/onboarding-flow";
import { FIELD_SELF_ID, SignalField, type FieldPerson } from "@/components/signal-field";
import { ShareTools } from "@/components/share-tools";
import { ThemeSwitch } from "@/components/theme-switch";

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
  { id: "active", label: "Activo", enabled: true, seeking: false },
  { id: "seeking", label: "Buscando", enabled: true, seeking: true },
];

const meta = "font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase";
const actionSize = "h-11 w-full min-[720px]:h-9 min-[720px]:w-auto";
const focusRing = "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

function evidenceOf(recommendation: NonNullable<FieldPerson["recommendation"]>) {
  return [
    ...recommendation.shared.interests.map((value) => ({ kind: "Interés común", value })),
    ...recommendation.shared.skills.map((value) => ({ kind: "Habilidad común", value })),
    ...recommendation.complement.map((value) => ({ kind: "Complementa", value })),
  ].slice(0, 3);
}

function reasonOf(person: FieldPerson) {
  return person.recommendation?.shared.interests[0] ?? person.recommendation?.shared.skills[0] ?? person.recommendation?.complement[0] ?? "objetivo común";
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
      setLoadError("No se pudo cargar el evento.");
      return;
    }
    const discovery = await discoveryResponse.json();
    setPresence(discovery.presence);
    setPeople(discovery.people);
    setConnections((await connectionsResponse.json()).connections ?? []);
    setLoadError(null);
  }, []);

  useEffect(() => {
    // La sesión vive en el servidor; el primer pintado tiene que leerla.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial, el setState ocurre tras el fetch
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
          ? "No hay evidencia suficiente para explicar esta conexión."
          : body.error === "presence"
            ? "Activa tu presencia para ver esta explicación."
            : "Meta no devolvió una explicación válida. No se ha sustituido por un texto inventado.",
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
        <p className="text-sm text-muted-foreground">Cargando la sesión.</p>
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
          <h1 className="font-heading text-[2rem] leading-none tracking-[-0.02em]">IntroMesh</h1>
          <p className="max-w-[36ch] text-sm text-muted-foreground">
            {session.event?.name}
            {session.event?.demo ? ". Los nodos demo no están en la sala." : "."}
          </p>
        </div>
        <div className="flex flex-col gap-2 min-[720px]:items-end">
          <ThemeSwitch className="absolute top-0 right-0 min-[720px]:static" />
          <div className="-mx-3 flex items-center justify-between gap-4 min-[720px]:justify-end">
            <div role="group" aria-label="Presencia" className="flex items-center">
              {PRESENCE_OPTIONS.map((option) => {
                const active = presence === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => void changePresence(option.enabled, option.seeking)}
                    className={cn(
                      "relative inline-flex h-11 items-center rounded-sm px-3 text-sm transition-colors select-none",
                      "after:absolute after:inset-x-3 after:bottom-2.5 after:h-px after:bg-foreground after:opacity-0 after:transition-opacity after:content-['']",
                      focusRing,
                      active ? "text-foreground after:opacity-100" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <Link
              href="/intelligence"
              className={cn("inline-flex h-11 items-center rounded-sm px-3 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline", focusRing)}
            >
              Inteligencia
            </Link>
          </div>
        </div>
      </header>

      {!session.metaConfigured ? (
        <p className="max-w-[62ch] shrink-0 text-sm text-muted-foreground">
          Demostración. Falta MODEL_API_KEY: las explicaciones salen de los datos declarados y no son respuestas de Meta AI.
        </p>
      ) : null}
      {loadError ? <p className="text-sm text-destructive">{loadError}</p> : null}

      <div className="grid min-h-0 flex-1 items-stretch gap-6 min-[720px]:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)] min-[720px]:gap-8">
        <SignalField
          people={visible ? people : []}
          selectedId={selectedId}
          onSelect={(id) => void openPerson(id === selectedId ? null : id)}
        />

        <section className="flex min-h-0 flex-col gap-6 min-[720px]:overflow-y-auto">
          {!visible ? (
            <p className="max-w-[40ch] text-sm text-muted-foreground">Estás invisible. Activa la presencia para ver a quien también está en el evento.</p>
          ) : null}

          {selfSelected && session.profile ? (
            <article className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h2 className="font-heading text-[2rem] leading-[0.95] tracking-[-0.03em] min-[720px]:text-[2.5rem]">{session.profile.displayName}</h2>
                <p className="text-sm text-muted-foreground">{session.profile.role} · Tú</p>
              </div>
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Intereses</dt>
                <dd>{session.profile.interests.join(", ")}</dd>
                <dt className="text-muted-foreground">Habilidades</dt>
                <dd>{session.profile.skills.join(", ")}</dd>
                <dt className="text-muted-foreground">Buscas</dt>
                <dd>{session.profile.seeking}</dd>
              </dl>
              <p className="max-w-[40ch] text-sm text-muted-foreground">Vuelve a pulsar tu nodo para ver el salón entero.</p>
            </article>
          ) : null}

          {detail ? (
            <article className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h2 className="font-heading text-[2rem] leading-[0.95] tracking-[-0.03em] text-balance min-[720px]:text-[2.5rem]">{detail.person.displayName}</h2>
                <p className="text-sm text-muted-foreground">
                  {detail.person.role}
                  {detail.person.demo ? " · Demostración" : ""}
                  {detail.recommendation.shared.goals[0] ? ` · ${detail.recommendation.shared.goals[0]}` : ""}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                  {evidenceOf(detail.recommendation).map((item) => (
                    <div key={`${item.kind}-${item.value}`} className="contents">
                      <dt className="text-muted-foreground">{item.kind}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
                <p className={meta}>
                  {detail.recommendation.confidence === "low"
                    ? "Confianza baja · no es un hecho"
                    : detail.recommendation.confidence === "medium"
                      ? "Confianza media"
                      : "Confianza alta"}
                </p>
              </div>

              {explainPending ? <p className="text-sm text-muted-foreground">Preparando la explicación.</p> : null}
              {explainError ? <p className="text-sm text-destructive">{explainError}</p> : null}
              {explanation ? (
                <div className="flex flex-col gap-3">
                  <p className="max-w-[52ch] text-[0.9375rem] leading-normal">{explanation.summary}</p>
                  <p className="max-w-[52ch] text-sm text-muted-foreground">{explanation.opener}</p>
                  <p className={meta}>{explanation.source === "model" ? "Meta AI" : "Demostración, no es Meta AI"}</p>
                </div>
              ) : null}

              <div className="flex flex-col gap-3">
                {relation?.status === "pending" ? <p className={meta}>Solicitud pendiente</p> : null}
                {relation?.status === "accepted" ? (
                  <p className="max-w-[52ch] text-sm">
                    Conexión aceptada. La introducción queda guardada{relation.intro ? `: ${relation.intro}` : "."}
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 min-[720px]:flex-row min-[720px]:items-center">
                  {!relation ? (
                    <Button type="button" className={actionSize} disabled={!explanation} onClick={() => void requestIntro()}>
                      Solicitar conexión
                    </Button>
                  ) : null}
                  {relation?.status === "pending" && relation.other.demo ? (
                    <Button type="button" className={actionSize} onClick={() => void resolve(relation, "accept")}>
                      Simular aceptación
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" className={actionSize} onClick={() => void openPerson(detail.person.id, true)}>
                    Regenerar
                  </Button>
                </div>
              </div>

              {relation?.status === "accepted" && session.profile ? <ShareTools slug={session.profile.slug} name={session.profile.displayName} /> : null}
            </article>
          ) : null}

          {visible ? (
            <div className={cn("flex flex-col gap-3", (detail || selfSelected) && "min-[720px]:hidden")}>
              <h2 className={meta}>{detail ? "Más señales" : "Recomendaciones"}</h2>
              {others.length === 0 ? (
                <p className="max-w-[40ch] text-sm text-muted-foreground">
                  {detail ? "No hay más señales ahora mismo." : "Nadie visible comparte un objetivo, un interés o una habilidad contigo."}
                </p>
              ) : (
                <ul className="flex flex-col">
                  {others.map((person) => (
                    <li key={person.id}>
                      <button
                        type="button"
                        onClick={() => void openPerson(person.id)}
                        className={cn("group flex min-h-11 w-full items-baseline justify-between gap-4 rounded-sm text-left text-sm min-[720px]:min-h-9", focusRing)}
                      >
                        <span className="shrink-0 underline-offset-4 group-hover:underline">
                          {person.displayName}
                          {person.demo ? <span className="text-muted-foreground"> · demo</span> : null}
                        </span>
                        <span className="truncate text-muted-foreground">{reasonOf(person)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
