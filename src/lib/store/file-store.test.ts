import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createFileStore } from "./file-store";

const dirs: string[] = [];

afterEach(async () => {
  dirs.length = 0;
});

async function tempStore() {
  const directory = await mkdtemp(path.join(tmpdir(), "intromesh-store-"));
  dirs.push(directory);
  return createFileStore(directory);
}

describe("createFileStore", () => {
  it("keeps concurrent updates without dropping identities", async () => {
    const store = await tempStore();
    await Promise.all([
      store.update((database) => {
        database.identities.push({
          userId: "user-a",
          displayName: "A",
          originalDescription: "Software engineer building networking tools for hackathons and events.",
          inputHash: "a",
          generated: null,
          confirmed: null,
          revision: 1,
          status: "draft",
          source: null,
          updatedAt: new Date().toISOString(),
        });
      }),
      store.update((database) => {
        database.participations.push({
          userId: "user-a",
          eventId: "meta-hackathon-2026",
          intentText: "Meet builders",
          lookingFor: [],
          collaborationInterests: [],
          revision: 1,
          inputHash: "p",
          consent: true,
          visibility: "discoverable",
          status: "joined",
          updatedAt: new Date().toISOString(),
        });
      }),
    ]);
    const snapshot = await store.read();
    expect(snapshot.identities.some((item) => item.userId === "user-a")).toBe(true);
    expect(snapshot.participations.some((item) => item.userId === "user-a")).toBe(true);
  });

  it("recovers a corrupt file without leaving readers hanging", async () => {
    const store = await tempStore();
    await writeFile(store.file, "{not-json", "utf8");
    const snapshot = await store.read();
    expect(snapshot.events.length).toBeGreaterThan(0);
    const raw = await readFile(store.file, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
