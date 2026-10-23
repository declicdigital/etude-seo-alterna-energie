import { describe, expect, it } from "vitest";
import { canEditBenchmark } from "@/lib/benchmark";
import { GEOFFREY_EMAIL } from "@/lib/step-reminders";

describe("canEditBenchmark", () => {
  it("autorise Geoffrey administrateur", () => {
    expect(canEditBenchmark(true, GEOFFREY_EMAIL)).toBe(true);
  });

  it("accepte la casse différente de l'e-mail de Geoffrey", () => {
    expect(canEditBenchmark(true, GEOFFREY_EMAIL.toUpperCase())).toBe(true);
  });

  it("refuse un autre administrateur", () => {
    expect(canEditBenchmark(true, "fannie.laurendin@soregies.fr")).toBe(false);
  });

  it("refuse Geoffrey sans rôle administrateur", () => {
    expect(canEditBenchmark(false, GEOFFREY_EMAIL)).toBe(false);
  });

  it("refuse un utilisateur sans e-mail", () => {
    expect(canEditBenchmark(true, null)).toBe(false);
    expect(canEditBenchmark(true, undefined)).toBe(false);
  });
});
