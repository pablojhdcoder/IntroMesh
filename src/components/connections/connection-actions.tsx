"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { connectionActionBody } from "@/components/signal/use-room";

export function ConnectionActions({
  connectionId,
  otherName,
  compact,
  onResolved,
}: {
  connectionId: string;
  otherName: string;
  compact?: boolean;
  /** Called after a successful resolve instead of the default router.refresh(). */
  onResolved?: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolve(action: "accept" | "decline") {
    if (pending) return;
    setPending(action);
    setError(null);
    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(connectionActionBody(connectionId, action)),
      });
      if (!response.ok) throw new Error("resolve");
      if (onResolved) onResolved();
      else router.refresh();
    } catch {
      setError("Could not update this request. Try again.");
      setPending(null);
    }
  }

  const size = compact ? "h-11 min-[720px]:h-9" : "h-11 min-[720px]:h-10";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 min-[720px]:flex-row">
        <Button
          type="button"
          className={size}
          disabled={pending !== null}
          onClick={() => void resolve("accept")}
          aria-label={`Accept request from ${otherName}`}
        >
          {pending === "accept" ? "Accepting…" : "Accept"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className={size}
          disabled={pending !== null}
          onClick={() => void resolve("decline")}
          aria-label={`Decline request from ${otherName}`}
        >
          {pending === "decline" ? "Declining…" : "Decline"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
