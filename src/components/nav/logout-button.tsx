"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn } from "cn";

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      aria-label="Log out"
      title="Log out"
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-raised hover:text-foreground min-[720px]:min-h-9",
        focusRing,
        className,
      )}
    >
      <LogOut aria-hidden="true" className="size-4" />
      <span className="hidden sm:inline">Log out</span>
    </button>
  );
}
