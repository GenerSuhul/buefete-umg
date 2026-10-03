import { describe, expect, it } from "vitest";
import { isValidPassword } from "./passwordPolicy";

describe("password policy", () => {
  it("accepts eight characters without composition rules", () => {
    expect(isValidPassword("abcdefgh")).toBe(true);
    expect(isValidPassword("12345678")).toBe(true);
  });

  it("rejects empty, short and overly long values", () => {
    expect(isValidPassword("        ")).toBe(false);
    expect(isValidPassword("abcdefg")).toBe(false);
    expect(isValidPassword("a".repeat(129))).toBe(false);
  });
});
