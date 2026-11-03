import type { Store } from "@/lib/store";
import { connectActions } from "@/server/connect";
import { discoverActions } from "@/server/discover";
import { explainActions } from "@/server/explain";
import { learnActions } from "@/server/learn";
import { hubActions } from "@/server/hub";
import { onboardingActions } from "@/server/onboarding";
import { presenceActions } from "@/server/presence";
import { profileActions } from "@/server/profile";
import { sessionActions } from "@/server/session";

export function createService(store: Store) {
  return {
    ...sessionActions(store),
    ...onboardingActions(store),
    ...presenceActions(store),
    ...discoverActions(store),
    ...explainActions(store),
    ...connectActions(store),
    ...learnActions(store),
    ...hubActions(store),
    ...profileActions(store),
  };
}

export type IntroMeshService = ReturnType<typeof createService>;
