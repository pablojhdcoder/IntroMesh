import { beforeEach, describe, expect, it } from "vitest";
import { contextualizeProfile, explainAffinity, modelConfigured } from "./explain";
import { MetaConfigError } from "./errors";
import type { ProfileInput, StoredProfile } from "@/domain/profile";

const KEY = "MODEL_API_KEY";
const previous = process.env[KEY];

beforeEach(() => {
  if (previous === undefined) delete process.env[KEY];
  else process.env[KEY] = previous;
});

function person(id: string): StoredProfile {
  return {
    id,
    slug: id,
    displayName: id,
    role: "Builder",
    bio: "",
    interests: ["models"],
    skills: ["backend"],
    projects: [],
    links: [],
    offers: "",
    seeking: "",
    goal: "collaborate",
    demo: false,
    presentation: null,
    createdAt: new Date().toISOString(),
  };
}

describe("modelConfigured", () => {
  it("is false without a key", () => {
    delete process.env[KEY];
    expect(modelConfigured()).toBe(false);
  });

  it("is true with a key", () => {
    process.env[KEY] = "test-key";
    expect(modelConfigured()).toBe(true);
  });
});

describe("contextualizeProfile", () => {
  it("throws a config error without a key instead of fabricating a demo presentation", async () => {
    delete process.env[KEY];
    const input: ProfileInput = {
      displayName: "Ada",
      role: "Builder",
      bio: "",
      interests: ["models"],
      skills: ["backend"],
      projects: [],
      links: [],
      offers: "",
      seeking: "",
      goal: "collaborate",
    };
    await expect(contextualizeProfile(input)).rejects.toBeInstanceOf(MetaConfigError);
  });
});

describe("explainAffinity", () => {
  it("throws a config error without a key instead of fabricating text", async () => {
    delete process.env[KEY];
    await expect(
      explainAffinity({
        viewer: person("viewer"),
        other: person("other"),
        shared: { goals: ["collaborate"], interests: ["models"], skills: [] },
        complement: [],
        confidence: "low",
      }),
    ).rejects.toBeInstanceOf(MetaConfigError);
  });
});
