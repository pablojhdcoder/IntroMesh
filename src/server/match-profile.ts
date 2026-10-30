import type { MatchProfile } from "@/domain/matching/select-candidates";
import type { StoredProfile } from "@/domain/profile";

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function asMatch(profile: StoredProfile): MatchProfile {
  return {
    id: profile.id,
    displayName: profile.displayName,
    discoverable: true,
    goals: [profile.goal],
    interests: profile.interests,
    skills: profile.skills,
    seeking: profile.seeking,
    demo: profile.demo,
  };
}
