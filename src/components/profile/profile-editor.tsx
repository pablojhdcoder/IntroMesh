"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { ClaimAccountForm } from "@/components/onboarding/claim-account-form";
import type { ProfileLike } from "@/components/profile/profile-view";

const meta = "font-mono text-[0.7rem] font-medium tracking-[0.08em] text-muted-foreground uppercase";
const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";
const field = cn(
  "min-h-11 w-full rounded-[8px] border border-border bg-surface px-3 py-2 text-base text-foreground min-[720px]:text-[0.9375rem]",
  focusRing,
);

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ProfileEditor({
  profile,
  onSaved,
  onCancel,
}: {
  profile: ProfileLike & { goal: string };
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [role, setRole] = useState(profile.role);
  const [interests, setInterests] = useState(profile.interests.join(", "));
  const [skills, setSkills] = useState(profile.skills.join(", "));
  const [projects, setProjects] = useState(profile.projects.join(", "));
  const [offers, setOffers] = useState(profile.offers ?? "");
  const [seeking, setSeeking] = useState(profile.seeking ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">(profile.profileVisibility ?? "public");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setStatus("idle");
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile: {
            displayName: profile.username ?? profile.displayName,
            role: role.trim(),
            bio: "",
            interests: splitList(interests),
            skills: splitList(skills),
            projects: splitList(projects),
            links: profile.links ?? [],
            offers: offers.trim(),
            seeking: seeking.trim(),
            goal: profile.goal,
          },
          presentation: profile.presentation ?? undefined,
        }),
      });
      if (!response.ok) throw new Error("save");
      const patch = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          avatarUrl: avatarUrl.trim() ? avatarUrl.trim() : null,
          profileVisibility: visibility,
        }),
      });
      if (!patch.ok) throw new Error("settings");
      setStatus("saved");
      router.refresh();
      onSaved?.();
    } catch {
      setStatus("error");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-4" aria-label="Edit profile">
      <h2 className="font-heading text-xl leading-none tracking-[-0.02em]">Edit profile</h2>

      {profile.username ? (
        <p className={meta}>Posting as @{profile.username}</p>
      ) : null}

      {!profile.username && !profile.demo ? (
        <div className="rounded-[12px] border border-border bg-surface p-4">
          <ClaimAccountForm onClaimed={() => router.refresh()} />
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-role" className={meta}>Role</label>
        <input id="profile-role" value={role} onChange={(e) => setRole(e.target.value)} required minLength={2} maxLength={80} autoFocus className={field} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-interests" className={meta}>Interests (comma separated)</label>
        <input id="profile-interests" value={interests} onChange={(e) => setInterests(e.target.value)} className={field} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-skills" className={meta}>Skills (comma separated)</label>
        <input id="profile-skills" value={skills} onChange={(e) => setSkills(e.target.value)} className={field} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-projects" className={meta}>Projects (comma separated)</label>
        <input id="profile-projects" value={projects} onChange={(e) => setProjects(e.target.value)} className={field} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-offers" className={meta}>Offers</label>
        <textarea id="profile-offers" value={offers} onChange={(e) => setOffers(e.target.value)} maxLength={240} rows={3} className={field} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-seeking" className={meta}>Seeking</label>
        <textarea id="profile-seeking" value={seeking} onChange={(e) => setSeeking(e.target.value)} maxLength={500} rows={3} className={field} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-avatar" className={meta}>Avatar URL</label>
        <input id="profile-avatar" type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" className={field} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-visibility" className={meta}>Profile visibility</label>
        <select
          id="profile-visibility"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as "public" | "private")}
          className={field}
        >
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} className="h-11 min-[720px]:h-9">
          {pending ? "Saving…" : "Save profile"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel} className="h-11 min-[720px]:h-9">
            Cancel
          </Button>
        ) : null}
        {status === "saved" ? (
          <p role="status" className="text-sm text-muted-foreground">Saved.</p>
        ) : null}
        {status === "error" ? (
          <p role="alert" className="text-sm text-destructive">Could not save. Check the fields and try again.</p>
        ) : null}
      </div>
    </form>
  );
}
