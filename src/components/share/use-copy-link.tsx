"use client";

import { useEffect, useRef, useState } from "react";

/** How long the copy button shows its Copied state before going back to normal. */
export const COPY_FEEDBACK_MS = 2000;

/**
 * Copy-to-clipboard with the feedback living on the button itself: `copied`
 * turns true for COPY_FEEDBACK_MS, then back to false. No status text needed;
 * pair with `CopyAnnouncer` for screen readers.
 */
export function useCopyLink(slug: string) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  function settle(next: { copied: boolean; failed: boolean }) {
    if (timer.current) window.clearTimeout(timer.current);
    setCopied(next.copied);
    setFailed(next.failed);
    timer.current = window.setTimeout(() => {
      setCopied(false);
      setFailed(false);
      timer.current = null;
    }, COPY_FEEDBACK_MS);
  }

  async function copyLink() {
    const url = typeof window === "undefined" ? `/u/${slug}` : `${window.location.origin}/u/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      settle({ copied: true, failed: false });
    } catch {
      settle({ copied: false, failed: true });
    }
  }

  return { copyLink, copied, failed };
}

/** Screen-reader-only live region announcing the copy outcome. */
export function CopyAnnouncer({ copied, failed }: { copied: boolean; failed: boolean }) {
  return (
    <span className="sr-only" role="status" aria-live="polite">
      {copied ? "Link copied" : null}
      {failed ? "Could not copy the link" : null}
    </span>
  );
}
