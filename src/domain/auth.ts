import { z } from "zod";

const RESERVED = new Set([
  "admin",
  "support",
  "intromesh",
  "demo",
  "api",
  "login",
  "register",
  "me",
  "root",
  "help",
  "about",
]);

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export const usernameSchema = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[a-z0-9][a-z0-9._]*[a-z0-9]$/)
  .refine((value) => !RESERVED.has(value), { message: "reserved" });

export type PasswordCheck = { id: string; label: string; met: boolean };

export function passwordChecks(password: string, username: string): PasswordCheck[] {
  const user = username.toLowerCase();
  return [
    { id: "length", label: "At least 10 characters", met: password.length >= 10 },
    { id: "lowercase", label: "One lowercase letter", met: /[a-z]/.test(password) },
    { id: "uppercase", label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { id: "number", label: "One number", met: /[0-9]/.test(password) },
    { id: "symbol", label: "One symbol", met: /[^A-Za-z0-9]/.test(password) },
    {
      id: "notUsername",
      label: "Does not contain your @",
      met: user.length < 3 || !password.toLowerCase().includes(user),
    },
  ];
}

export function isPasswordStrong(password: string, username: string): boolean {
  return passwordChecks(password, username).every((item) => item.met);
}

export const registerSchema = z.object({
  username: z.string().min(1).max(25),
  password: z.string().min(1).max(128),
});

export const loginSchema = z.object({
  username: z.string().min(1).max(25),
  password: z.string().min(1).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
