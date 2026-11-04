"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { ArrowLeft, Maximize2, Pencil, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Crossfade } from "@/components/ui/crossfade";
import { ProfileHero } from "@/components/profile/profile-hero";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { ProfileSections, type ProfileLike } from "@/components/profile/profile-view";
import { PresentCardOverlay, ProfileCardActions, ShowCardFace } from "@/components/profile/show-card";
import { cn } from "cn";

export function ProfileManager({
  profile,
  connectionsCount,
}: {
  profile: ProfileLike & { goal: string };
  connectionsCount: number;
}) {
  const [flipped, setFlipped] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const reduce = useReducedMotion();
  const showCardRef = useRef<HTMLButtonElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const isPrivate = profile.profileVisibility === "private";
  const closeExpanded = useCallback(() => setExpanded(false), []);

  useEffect(() => {
    if (flipped) (expandRef.current ?? backRef.current)?.focus();
  }, [flipped]);

  useEffect(() => {
    if (!flipped || expanded) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") flipBack();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flipped, expanded]);

  function flipBack() {
    setFlipped(false);
    showCardRef.current?.focus();
  }

  function closeEditor() {
    setEditing(false);
    editRef.current?.focus();
  }

  const frontActions = (
    <>
      <Button
        ref={showCardRef}
        type="button"
        aria-expanded={flipped}
        aria-controls="profile-card-back"
        className="h-11 min-[720px]:h-9"
        onClick={() => setFlipped(true)}
      >
        <QrCode aria-hidden="true" />
        Show my card
      </Button>
      <Button
        ref={editRef}
        type="button"
        variant="outline"
        aria-expanded={editing}
        aria-controls="profile-details-region"
        className="h-11 min-[720px]:h-9"
        onClick={() => (editing ? closeEditor() : setEditing(true))}
      >
        <Pencil aria-hidden="true" />
        Edit profile
      </Button>
    </>
  );

  return (
    <div className="flex flex-col gap-12">
      <div className="[perspective:1200px]" inert={expanded} aria-hidden={expanded}>
        <div
          className={cn(
            "relative grid transition-transform duration-[280ms] ease-[var(--ease-in-out)] [transform-style:preserve-3d]",
          )}
          style={reduce ? undefined : { transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          <div
            className={cn(
              "transition-opacity duration-[160ms] [grid-area:1/1] [backface-visibility:hidden]",
              reduce && flipped && "invisible opacity-0",
            )}
            aria-hidden={flipped}
            inert={flipped}
          >
            <ProfileHero profile={profile} stats={{ connections: connectionsCount }} actions={frontActions} />
          </div>

          <div
            id="profile-card-back"
            className={cn(
              "flex [grid-area:1/1] flex-col items-center justify-center gap-4 transition-opacity duration-[160ms] [backface-visibility:hidden]",
              !reduce && "[transform:rotateY(180deg)]",
              reduce && !flipped && "invisible opacity-0",
            )}
            aria-hidden={!flipped}
            inert={!flipped}
          >
            <h2 className="sr-only">Your connection card</h2>
            {isPrivate ? (
              <div className="w-full max-w-sm rounded-[20px] border border-border bg-surface p-5 shadow-[var(--shadow-raise)]" role="note">
                <p className="text-[0.9375rem] leading-relaxed">
                  Your card is hidden while your profile is private. The QR code is disabled — make your profile
                  public in Edit profile to show your card again.
                </p>
              </div>
            ) : (
              <>
                <ShowCardFace profile={profile} />
                <div className="flex w-full max-w-sm flex-col gap-2">
                  <Button ref={expandRef} type="button" variant="outline" className="h-11 min-[720px]:h-9" onClick={() => setExpanded(true)}>
                    <Maximize2 aria-hidden="true" />
                    Expand card
                  </Button>
                  <ProfileCardActions profile={profile} />
                </div>
              </>
            )}
            <Button ref={backRef} type="button" variant="ghost" className="h-11 min-[720px]:h-9" onClick={flipBack}>
              <ArrowLeft aria-hidden="true" />
              Back to profile
            </Button>
          </div>
        </div>
      </div>

      <div id="profile-details-region" inert={expanded} aria-hidden={expanded}>
      <Crossfade id={editing ? "edit" : "details"} className="flex flex-col gap-8">
        {editing ? (
          <ProfileEditor profile={profile} onSaved={closeEditor} onCancel={closeEditor} />
        ) : (
          <>
            <ProfileSections profile={profile} />
            <p className="border-t border-border pt-6 text-sm text-muted-foreground">
              {connectionsCount} accepted {connectionsCount === 1 ? "connection" : "connections"} ·{" "}
              <Link href="/connections" className="underline underline-offset-4">
                View connections
              </Link>
            </p>
          </>
        )}
      </Crossfade>
      </div>

      {expanded && !isPrivate ? (
        <PresentCardOverlay profile={profile} onClose={closeExpanded} />
      ) : null}
    </div>
  );
}
