import { z } from "zod";
import { GOALS } from "./catalog";

const goalIds = GOALS.map((goal) => goal.id) as [string, ...string[]];

export const profileInputSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  role: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(400).default(""),
  interests: z.array(z.string().trim().min(2).max(48)).max(12).default([]),
  skills: z.array(z.string().trim().min(2).max(48)).max(12).default([]),
  projects: z.array(z.string().trim().min(2).max(80)).max(8).default([]),
  links: z
    .array(
      z.object({
        label: z.string().trim().min(2).max(24),
        url: z
          .string()
          .url()
          .max(200)
          .refine((value) => value.startsWith("https://") || value.startsWith("http://"), {
            message: "Only http(s) links are allowed",
          }),
      }),
    )
    .max(4)
    .default([]),
  offers: z.string().trim().max(240).default(""),
  seeking: z.string().trim().max(500).default(""),
  goal: z.enum(goalIds),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

export const presentationSchema = z.object({
  source: z.enum(["model", "user"]),
  headline: z.string().trim().min(1).max(90),
  summary: z.string().trim().min(1).max(360),
  opener: z.string().trim().min(1).max(220),
});

export type Presentation = z.infer<typeof presentationSchema>;

export type StoredProfile = ProfileInput & {
  id: string;
  slug: string;
  demo: boolean;
  presentation: Presentation | null;
  createdAt: string;
  username?: string | null;
  avatarUrl?: string | null;
  profileVisibility?: "public" | "private";
};

export type PublicProfile = Pick<
  StoredProfile,
  | "id"
  | "slug"
  | "displayName"
  | "role"
  | "interests"
  | "skills"
  | "projects"
  | "links"
  | "offers"
  | "seeking"
  | "goal"
  | "demo"
  | "presentation"
> & {
  username?: string | null;
  avatarUrl?: string | null;
  profileVisibility?: "public" | "private";
};

export type SharedCard = Pick<
  PublicProfile,
  "id" | "slug" | "displayName" | "role" | "interests" | "skills" | "projects" | "goal" | "demo" | "presentation"
> & { username?: string | null };

export function toSharedCard(profile: StoredProfile): SharedCard {
  return {
    id: profile.id,
    slug: profile.slug,
    username: profile.username ?? null,
    displayName: profile.displayName,
    role: profile.role,
    interests: profile.interests,
    skills: profile.skills,
    projects: profile.projects,
    goal: profile.goal,
    demo: profile.demo,
    presentation: profile.presentation,
  };
}

export function toPublicProfile(profile: StoredProfile): PublicProfile {
  return {
    id: profile.id,
    slug: profile.slug,
    username: profile.username ?? null,
    displayName: profile.displayName,
    role: profile.role,
    interests: profile.interests,
    skills: profile.skills,
    projects: profile.projects,
    links: profile.links,
    offers: profile.offers,
    seeking: profile.seeking,
    goal: profile.goal,
    demo: profile.demo,
    presentation: profile.presentation,
    avatarUrl: profile.avatarUrl ?? null,
    profileVisibility: profile.profileVisibility ?? "public",
  };
}
