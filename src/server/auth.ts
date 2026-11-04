import { isPasswordStrong, normalizeUsername, usernameSchema } from "@/domain/auth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { newId } from "@/lib/meta/explain";
import type { Store } from "@/lib/store";

export type Availability = {
  available: boolean;
  reason: "available" | "taken" | "invalid" | "reserved";
};

export function authActions(store: Store) {
  async function taken(normalized: string, excludeUserId: string | null = null): Promise<boolean> {
    const database = await store.read();
    if (
      database.accounts.some((item) => item.username === normalized && item.userId !== excludeUserId)
    ) {
      return true;
    }
    return database.profiles.some(
      (item) => item.username?.toLowerCase() === normalized && item.id !== excludeUserId,
    );
  }

  return {
    async checkUsername(rawUsername: string): Promise<Availability> {
      const normalized = normalizeUsername(rawUsername);
      if (!usernameSchema.safeParse(normalized).success) {
        const reserved = /^[a-z0-9][a-z0-9._]*[a-z0-9]$/.test(normalized) && normalized.length >= 3 && normalized.length <= 20;
        return { available: false, reason: reserved ? "reserved" : "invalid" };
      }
      if (await taken(normalized)) return { available: false, reason: "taken" };
      return { available: true, reason: "available" };
    },

    async register(input: { username: string; password: string }) {
      const normalized = normalizeUsername(input.username);
      if (!usernameSchema.safeParse(normalized).success) return { error: "username_taken" as const };
      if (!isPasswordStrong(input.password, normalized)) return { error: "password_weak" as const };
      const passwordHash = await hashPassword(input.password);
      return store.update((database) => {
        if (
          database.accounts.some((item) => item.username === normalized) ||
          database.profiles.some((item) => item.username?.toLowerCase() === normalized)
        ) {
          return { error: "username_taken" as const };
        }
        const now = new Date().toISOString();
        const userId = `user-${newId()}`;
        database.accounts.push({
          userId,
          username: normalized,
          passwordHash,
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now,
        });
        return { userId, username: normalized };
      });
    },

    async login(input: { username: string; password: string }) {
      const normalized = normalizeUsername(input.username);
      const database = await store.read();
      const account = database.accounts.find((item) => item.username === normalized);
      if (!account) return { error: "credentials" as const };
      if (!(await verifyPassword(input.password, account.passwordHash))) {
        return { error: "credentials" as const };
      }
      await store.update((db) => {
        const current = db.accounts.find((item) => item.userId === account.userId);
        if (current) {
          current.lastLoginAt = new Date().toISOString();
          current.updatedAt = new Date().toISOString();
        }
      });
      return { userId: account.userId, username: account.username };
    },

    async claim(profileId: string, input: { username: string; password: string }) {
      const normalized = normalizeUsername(input.username);
      if (!usernameSchema.safeParse(normalized).success) return { error: "username_taken" as const };
      if (!isPasswordStrong(input.password, normalized)) return { error: "password_weak" as const };
      const passwordHash = await hashPassword(input.password);
      return store.update((database) => {
        const profile = database.profiles.find((item) => item.id === profileId);
        if (!profile) return { error: "profile" as const };
        if (profile.demo) return { error: "demo" as const };
        if (database.accounts.some((item) => item.userId === profileId)) {
          return { error: "account_exists" as const };
        }
        if (
          database.accounts.some((item) => item.username === normalized) ||
          database.profiles.some(
            (item) => item.username?.toLowerCase() === normalized && item.id !== profileId,
          )
        ) {
          return { error: "username_taken" as const };
        }
        const now = new Date().toISOString();
        database.accounts.push({
          userId: profileId,
          username: normalized,
          passwordHash,
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now,
        });
        profile.username = normalized;
        return { userId: profileId, username: normalized };
      });
    },
  };
}
