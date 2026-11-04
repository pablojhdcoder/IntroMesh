import { describe, expect, it, vi, afterEach } from "vitest";
import {
  clearInflight,
  clearRoomCache,
  fetchJsonDeduped,
  getCachedRoom,
  resolveRoomState,
  setCachedRoom,
} from "@/components/signal/use-room";

afterEach(() => {
  clearRoomCache();
  clearInflight();
  vi.unstubAllGlobals();
});

describe("resolveRoomState", () => {
  it("returns error when the load failed", () => {
    expect(resolveRoomState({ loading: false, error: "Could not load the event.", count: 0 })).toBe("error");
  });

  it("returns loading while the first response is pending and nothing is cached", () => {
    expect(resolveRoomState({ loading: true, error: null, count: 0 })).toBe("loading");
  });

  it("keeps success during a background refresh when cached people exist", () => {
    expect(resolveRoomState({ loading: true, error: null, count: 3 })).toBe("success");
  });

  it("returns empty only after a successful load confirmed zero people", () => {
    expect(resolveRoomState({ loading: false, error: null, count: 0 })).toBe("empty");
  });

  it("returns success when people are present", () => {
    expect(resolveRoomState({ loading: false, error: null, count: 2 })).toBe("success");
  });
});

describe("room cache", () => {
  it("stores and returns a snapshot per event id", () => {
    expect(getCachedRoom("event-a")).toBeNull();
    setCachedRoom("event-a", { people: [], connections: [], at: 1 });
    setCachedRoom("event-b", { people: [], connections: [], at: 2 });
    expect(getCachedRoom("event-a")?.at).toBe(1);
    expect(getCachedRoom("event-b")?.at).toBe(2);
    expect(getCachedRoom("event-c")).toBeNull();
  });

  it("round-trips the directory and embedding status with the roster", () => {
    setCachedRoom("event-pending", {
      people: [],
      directory: [
        {
          id: "bea",
          slug: "bea",
          username: null,
          displayName: "Bea",
          role: "Design",
          demo: true,
          interests: ["typography"],
          skills: ["figma"],
        },
      ],
      connections: [],
      viewerEmbeddingStatus: "pending",
      at: 3,
    });
    const cached = getCachedRoom("event-pending");
    expect(cached?.directory?.map((person) => person.id)).toEqual(["bea"]);
    expect(cached?.viewerEmbeddingStatus).toBe("pending");
  });
});

describe("fetchJsonDeduped", () => {
  it("collapses concurrent callers for the same key into one fetch", async () => {
    const json = vi.fn().mockResolvedValue({ people: [] });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json });
    vi.stubGlobal("fetch", fetchMock);
    const [first, second] = await Promise.all([
      fetchJsonDeduped("discovery:event-a", "/api/discovery?eventId=event-a"),
      fetchJsonDeduped("discovery:event-a", "/api/discovery?eventId=event-a"),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ ok: true, body: { people: [] } });
    expect(second).toEqual({ ok: true, body: { people: [] } });
  });

  it("fetches again after the first call settles", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ people: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ people: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    await fetchJsonDeduped("discovery:event-a", "/api/discovery?eventId=event-a");
    await fetchJsonDeduped("discovery:event-a", "/api/discovery?eventId=event-a");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
