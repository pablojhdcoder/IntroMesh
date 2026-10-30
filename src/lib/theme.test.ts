import { describe, expect, it } from "vitest";
import { parseTheme } from "@/lib/theme";

describe("parseTheme", () => {
  it("opens in light when no choice is stored", () => {
    expect(parseTheme(undefined)).toBe("light");
    expect(parseTheme(null)).toBe("light");
    expect(parseTheme("")).toBe("light");
    expect(parseTheme("system")).toBe("light");
  });

  it("conserva el modo oscuro elegido a mano", () => {
    expect(parseTheme("dark")).toBe("dark");
  });
});
