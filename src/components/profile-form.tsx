"use client";

import { useState } from "react";
import { GOALS, INTERESTS, SKILLS } from "@/domain/catalog";
import type { Presentation, ProfileInput } from "@/domain/profile";
import { Button } from "@/components/ui/button";
import { ThemeSwitch } from "@/components/theme-switch";

const empty: ProfileInput = {
  displayName: "",
  role: "",
  bio: "",
  interests: ["modelos"],
  skills: ["prototipado"],
  projects: [],
  links: [],
  offers: "",
  seeking: "",
  goal: "hackathon",
};

const field = "flex flex-col gap-2 text-sm text-muted-foreground";
const input = "h-11 rounded-lg border border-border bg-transparent px-3";
const textarea = "min-h-20 rounded-lg border border-border bg-transparent px-3 py-2";
const chip = "h-11 px-3 min-[720px]:h-9";
const meta = "font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase";

export function ProfileForm({
  metaConfigured,
  onSaved,
}: {
  metaConfigured: boolean;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ProfileInput>(empty);
  const [project, setProject] = useState("");
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"draft" | "save" | null>(null);

  function toggle(list: "interests" | "skills", value: string) {
    setDraft((current) => {
      const has = current[list].includes(value);
      const next = has ? current[list].filter((item) => item !== value) : [...current[list], value];
      return { ...current, [list]: next.slice(0, 6) };
    });
  }

  async function draftPresentation() {
    setPending("draft");
    setError(null);
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: draft }),
    });
    const body = await response.json();
    setPending(null);
    if (!response.ok) {
      setError("No se pudo redactar la presentación. Revisa los campos o el estado de Meta.");
      return;
    }
    setPresentation(body.presentation as Presentation);
  }

  async function save() {
    setPending("save");
    setError(null);
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile: { ...draft, projects: project ? [project] : draft.projects }, presentation }),
    });
    setPending(null);
    if (!response.ok) {
      setError("El perfil no se ha guardado. Nombre, rol, un interés, una habilidad y lo que buscas son obligatorios.");
      return;
    }
    onSaved();
  }

  return (
    <form
      className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-6 sm:px-8 min-[720px]:py-12"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-[2rem] leading-none tracking-[-0.02em] min-[720px]:text-[2.5rem]">Tu identidad</h1>
          <p className="max-w-[40ch] text-sm text-muted-foreground">Un perfil para todos los eventos. La presentación se edita antes de compartirla.</p>
        </div>
        <ThemeSwitch />
      </div>

      <div className="flex flex-col gap-4">
        <label className={field}>
          Nombre
          <input className={input} value={draft.displayName} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} required />
        </label>
        <label className={field}>
          Rol
          <input className={input} value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value })} required />
        </label>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm text-muted-foreground">Objetivo en este evento</legend>
        <div className="flex flex-wrap gap-2">
          {GOALS.map((goal) => {
            const selected = draft.goal === goal.id;
            return (
              <Button
                key={goal.id}
                type="button"
                variant={selected ? "secondary" : "outline"}
                className={selected ? `${chip} border-foreground` : chip}
                aria-pressed={selected}
                onClick={() => setDraft({ ...draft, goal: goal.id })}
              >
                {goal.label}
              </Button>
            );
          })}
        </div>
      </fieldset>

      <ChipSet legend="Intereses" options={INTERESTS} selected={draft.interests} onToggle={(value) => toggle("interests", value)} />
      <ChipSet legend="Habilidades" options={SKILLS} selected={draft.skills} onToggle={(value) => toggle("skills", value)} />

      <div className="flex flex-col gap-4">
        <label className={field}>
          Proyecto
          <input className={input} value={project} onChange={(event) => setProject(event.target.value)} />
        </label>
        <label className={field}>
          Qué puedes aportar
          <textarea className={textarea} value={draft.offers} onChange={(event) => setDraft({ ...draft, offers: event.target.value })} />
        </label>
        <label className={field}>
          Qué estás buscando
          <textarea className={textarea} value={draft.seeking} onChange={(event) => setDraft({ ...draft, seeking: event.target.value })} required />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col-reverse gap-2 min-[720px]:flex-row min-[720px]:items-center">
          <Button type="button" variant="outline" className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto" disabled={pending !== null} onClick={() => void draftPresentation()}>
            {pending === "draft" ? "Redactando" : "Redactar presentación"}
          </Button>
          <Button type="submit" className="h-11 w-full min-[720px]:h-9 min-[720px]:w-auto" disabled={pending !== null}>
            {pending === "save" ? "Guardando" : "Entrar al evento"}
          </Button>
        </div>
        <p className="max-w-[52ch] text-sm text-muted-foreground">
          {metaConfigured
            ? "La redacción usa Meta AI. Puedes corregirla antes de guardarla."
            : "Demostración. No hay MODEL_API_KEY: la redacción se arma solo con tus campos y no es una respuesta del modelo."}
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      {presentation ? (
        <div className="flex flex-col gap-4 border-t border-border pt-8">
          <p className={meta}>
            {presentation.source === "model" ? "Presentación · Meta AI" : presentation.source === "demo" ? "Presentación · Demostración, no es Meta AI" : "Presentación · editada"}
          </p>
          <label className={field}>
            Titular
            <input className={input} value={presentation.headline} onChange={(event) => setPresentation({ ...presentation, headline: event.target.value, source: "user" })} />
          </label>
          <label className={field}>
            Resumen
            <textarea className={`${textarea} min-h-24`} value={presentation.summary} onChange={(event) => setPresentation({ ...presentation, summary: event.target.value, source: "user" })} />
          </label>
          <label className={field}>
            Cómo empezar
            <textarea className={textarea} value={presentation.opener} onChange={(event) => setPresentation({ ...presentation, opener: event.target.value, source: "user" })} />
          </label>
        </div>
      ) : null}
    </form>
  );
}

function ChipSet({
  legend,
  options,
  selected,
  onToggle,
}: {
  legend: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm text-muted-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <Button
              key={option}
              type="button"
              variant={active ? "secondary" : "outline"}
              className={active ? `${chip} border-foreground` : chip}
              aria-pressed={active}
              onClick={() => onToggle(option)}
            >
              {option}
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}
