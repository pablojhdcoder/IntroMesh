"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Link2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const handle = profile.username ?? profile.slug;
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
          <p className="sr-only">{profile.displayName}</p>
          <p className="font-heading text-3xl leading-none tracking-[-0.02em] break-all text-balance">@{handle}</p>
          {profile.role ? <p className="text-sm leading-relaxed text-background/70 dark:text-muted-foreground">{profile.role}</p> : null}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <ProfileQr slug={profile.slug} name={profile.displayName} size={176} />
        <p className={`${metaOnCard} text-background/70 dark:text-muted-foreground`}>Scan to connect</p>
      </div>

      <p className={`${metaOnCard} mt-auto text-background/70 dark:text-muted-foreground`}>/u/{profile.slug}</p>
    </article>
  );
}

import { useCopyLink, CopyAnnouncer } from "@/components/share/use-copy-link";

export function ProfileCardActions({ profile }: { profile: ProfileLike }) {
  const { copyLink, copied, failed } = useCopyLink(profile.slug);

  return (
    <div className="flex w-full flex-col gap-2">
      <Button type="button" className="h-11 w-full min-[720px]:h-9" onClick={() => void copyLink()}>
        {copied ? <Check aria-hidden="true" /> : failed ? <X aria-hidden="true" /> : <Link2 aria-hidden="true" />}
        {copied ? "Copied" : failed ? "Couldn't copy" : "Copy link"}
      </Button>
      <CopyAnnouncer copied={copied} failed={failed} />
    </div>
  );
}

export function PresentCardOverlay({
  profile,
  onClose,
}: {
  profile: ProfileLike;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
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
      trigger?.focus?.();
    };
  }, [onClose]);

  return (
    <AnimatePresence>
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
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </Button>
        <ShowCardFace profile={profile} />
        <div className="w-full max-w-sm">
          <ProfileCardActions profile={profile} />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
