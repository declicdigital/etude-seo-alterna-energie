import { describe, expect, it } from "vitest";
import { canEditBenchmark } from "@/lib/benchmark";
const GEOFFREY_EMAIL = "geoffrey.delabarre@alterna-energie.fr";

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

  it("autorise Matthieu administrateur", () => {
    expect(canEditBenchmark(true, "matthieu.roux@alterna-energie.fr")).toBe(true);
  });

  it("autorise Charlotte avec un compte approuvé, même sans rôle admin", () => {
    expect(canEditBenchmark(false, "charlotte.places@alterna-energie.fr", true)).toBe(true);
    expect(canEditBenchmark(false, "Charlotte.Places@alterna-energie.fr", true)).toBe(true);
  });

  it("refuse Charlotte sans compte approuvé", () => {
    expect(canEditBenchmark(false, "charlotte.places@alterna-energie.fr", false)).toBe(false);
  });

  it("refuse un autre compte approuvé non admin", () => {
    expect(canEditBenchmark(false, "fannie.laurendin@soregies.fr", true)).toBe(false);
  });

  it("refuse un utilisateur sans e-mail", () => {
    expect(canEditBenchmark(true, null)).toBe(false);
    expect(canEditBenchmark(true, undefined)).toBe(false);
  });
});
