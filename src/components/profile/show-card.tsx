"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Contact, Link2, Maximize2, QrCode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Crossfade } from "@/components/ui/crossfade";
import { ProfileQr } from "@/components/share/profile-qr";
import type { ProfileLike } from "@/components/profile/profile-view";

const easeOut = [0.23, 1, 0.32, 1] as const;
const metaOnCard = "font-mono text-[0.7rem] font-medium tracking-[0.08em] uppercase";

function initialsOf(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function ShowCardFace({ profile }: { profile: ProfileLike }) {
  return (
    <article
      aria-label={`Connection card for ${profile.displayName}`}
      className="flex w-full max-w-sm flex-col gap-5 rounded-[20px] bg-foreground p-6 text-background shadow-[var(--shadow-raise)] dark:border dark:border-border dark:bg-surface-raised dark:text-foreground"
    >
      <div className="flex items-center justify-between gap-4">
        <p className={`${metaOnCard} text-background/70 dark:text-muted-foreground`}>IntroMesh</p>
        {profile.demo ? (
          <span className="inline-flex min-h-6 items-center rounded-full border border-background/30 px-2.5 py-0.5 font-mono text-[0.65rem] font-medium tracking-[0.08em] uppercase dark:border-border">
            Demo
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        {profile.avatarUrl ? (
          <Image
            src={profile.avatarUrl}
            alt={`Profile photo of ${profile.displayName}`}
            width={64}
            height={64}
            unoptimized
            className="size-16 shrink-0 rounded-full border border-background/25 object-cover dark:border-border"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-signal font-heading text-2xl text-[#14160c]"
          >
            {initialsOf(profile.displayName)}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="font-heading text-3xl leading-none tracking-[-0.02em] text-balance">{profile.displayName}</p>
          {profile.username ? <p className="font-mono text-sm font-medium tracking-[0.08em] text-signal">@{profile.username}</p> : null}
          {profile.role ? <p className="text-sm leading-relaxed text-background/70 dark:text-muted-foreground">{profile.role}</p> : null}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <ProfileQr slug={profile.slug} name={profile.displayName} size={176} />
        <p className={`${metaOnCard} text-background/70 dark:text-muted-foreground`}>Scan to connect</p>
      </div>

      {profile.interests.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Interests">
          {profile.interests.slice(0, 3).map((interest) => (
            <li
              key={interest}
              className="inline-flex min-h-8 items-center rounded-full border border-background/25 px-3 py-1 text-sm dark:border-border"
            >
              {interest}
            </li>
          ))}
        </ul>
      ) : null}

      <p className={`${metaOnCard} mt-auto text-background/70 dark:text-muted-foreground`}>/u/{profile.slug}</p>
    </article>
  );
}

export function ShowCard({ profile }: { profile: ProfileLike }) {
  const [view, setView] = useState<"profile" | "card">("profile");
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const isPrivate = profile.profileVisibility === "private";
  const copied = message === "Link copied.";

  const url = typeof window === "undefined" ? `/u/${profile.slug}` : `${window.location.origin}/u/${profile.slug}`;

  useEffect(() => {
    if (!expanded) return;
    const trigger = expandRef.current;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setExpanded(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      trigger?.focus();
    };
  }, [expanded]);

  async function track(method: "link" | "qr" | "vcard") {
    try {
      await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method }),
      });
    } catch {
      // Analytics is best-effort; never block the share action.
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Link copied.");
    } catch {
      setMessage("Could not copy the link. Copy it from the card address instead.");
    }
    await track("link");
  }

  function expandCard() {
    setExpanded(true);
    void track("qr");
  }

  const actions = (
    <div className="flex w-full max-w-sm flex-col gap-2 min-[720px]:flex-row min-[720px]:flex-wrap">
      <Button type="button" className="h-11 min-[720px]:h-9" onClick={() => void copyLink()}>
        {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
        Copy link
      </Button>
      <Button
        asChild
        variant="outline"
        className="h-11 min-[720px]:h-9"
        onClick={() => void track("vcard")}
      >
        <a href={`/api/profiles/${profile.slug}/vcard`} download={`${profile.slug}.vcf`}>
          <Contact aria-hidden="true" />
          Save contact (.vcf)
        </a>
      </Button>
    </div>
  );

  const status = message ? (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
      <Check aria-hidden="true" className="size-4 shrink-0 text-foreground" />
      {message}
    </p>
  ) : null;

  const privateNote = (
    <div className="w-full max-w-sm rounded-[20px] border border-border bg-surface p-5 shadow-[var(--shadow-raise)]" role="note">
      <p className="text-[0.9375rem] leading-relaxed">
        Your card is hidden while your profile is private. The QR code is disabled — make your profile public to show
        your card again.
      </p>
    </div>
  );

  return (
    <section className="flex flex-col items-start gap-5" aria-label="Show your card">
      <div
        className="inline-flex rounded-[12px] border border-border bg-surface p-1"
        role="group"
        aria-label="Profile view"
      >
        <button
          type="button"
          aria-pressed={view === "profile"}
          aria-controls="show-card-panel"
          onClick={() => setView("profile")}
          className={`inline-flex min-h-11 items-center rounded-[8px] px-4 text-sm font-medium transition-[transform,background-color,color] duration-[160ms] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.97] min-[720px]:min-h-9 ${
            view === "profile" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Profile
        </button>
        <button
          type="button"
          aria-pressed={view === "card"}
          aria-controls="show-card-panel"
          onClick={() => setView("card")}
          className={`inline-flex min-h-11 items-center rounded-[8px] px-4 text-sm font-medium transition-[transform,background-color,color] duration-[160ms] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.97] min-[720px]:min-h-9 ${
            view === "card" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Card
        </button>
      </div>

      <div id="show-card-panel" role="region" aria-label="Card preview" className="w-full">
      <Crossfade id={view} className="flex w-full flex-col items-start gap-4">
        {view === "card" ? (
          isPrivate ? (
            privateNote
          ) : (
            <>
              <ShowCardFace profile={profile} />
              <div className="flex w-full max-w-sm flex-col gap-3">
                <Button ref={expandRef} type="button" variant="outline" className="h-11 min-[720px]:h-9" onClick={expandCard}>
                  <Maximize2 aria-hidden="true" />
                  Expand card
                </Button>
                {expanded ? null : (
                  <>
                    {actions}
                    {status}
                  </>
                )}
              </div>
            </>
          )
        ) : (
          <div className="flex w-full flex-col items-start gap-3">
            <p className="max-w-[48ch] text-[0.9375rem] leading-relaxed text-muted-foreground">
              Show your card in person so someone can scan it and connect with you.
            </p>
            <Button type="button" className="h-11 w-full min-[720px]:w-auto" onClick={() => setView("card")}>
              <QrCode aria-hidden="true" />
              Show my card
            </Button>
            {isPrivate ? (
              <p className="max-w-[48ch] text-sm leading-relaxed text-muted-foreground">
                Your profile is private, so your card and QR code stay hidden.
              </p>
            ) : null}
          </div>
        )}
      </Crossfade>
      </div>

      <AnimatePresence>
        {expanded && !isPrivate ? (
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Connection card for ${profile.displayName}`}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 overflow-y-auto bg-background p-4"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.16, ease: easeOut } }}
            transition={{ duration: reduce ? 0.16 : 0.28, ease: easeOut }}
          >
            <Button
              ref={closeRef}
              type="button"
              variant="outline"
              size="icon-lg"
              aria-label="Close card"
              className="absolute top-4 right-4"
              onClick={() => setExpanded(false)}
            >
              <X aria-hidden="true" />
            </Button>
            <ShowCardFace profile={profile} />
            {actions}
            {status}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
